import { PermissionsAndroid, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { isDemoMode, requireSupabase } from "./supabase";
import { getPostsByIds } from "./posts";
import { mockPosts } from "../data/mock";
import type { NeedPost } from "./mappers";
import {
  aroundYouEnabled,
  bluetoothProblem,
  heardCodes,
  type HeardCode,
} from "../utils/aroundYou";

/** modules/nearby-ble (Android only). */
type NearbyBleNative = {
  isSupported(): boolean;
  isBluetoothOn(): boolean;
  sharingPostId(): string | null;
  stopSharing(): void;
  startSharing(
    postId: string,
    title: string,
    codes: { code: string; fromMs: number; untilMs: number }[],
    endsMs: number,
  ): Promise<void>;
  scan(durationMs: number): Promise<HeardCode[]>;
};

const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<NearbyBleNative>("NearbyBle")
    : null;

function nativeSupported(): boolean {
  try {
    return !!native?.isSupported();
  } catch {
    return false;
  }
}

/** Shown only in feature builds, on phones with Bluetooth (or in demo mode). */
export function aroundYouAvailable(): boolean {
  return aroundYouEnabled() && (nativeSupported() || isDemoMode());
}

function problem(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  return new Error(bluetoothProblem(code));
}

async function allowed(
  permissions: (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS][],
): Promise<void> {
  if (Platform.OS !== "android") return;
  const result = await PermissionsAndroid.requestMultiple(permissions);
  if (
    Object.values(result).some((r) => r !== PermissionsAndroid.RESULTS.GRANTED)
  )
    throw new Error(bluetoothProblem("PERMISSION"));
}

const newAndroid = () =>
  Platform.OS === "android" && Number(Platform.Version) >= 31;

async function allowScan() {
  await allowed(
    newAndroid()
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION],
  );
}

async function allowShare() {
  if (newAndroid())
    await allowed([PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE]);
}

const demoSharing = new Map<string, number>();

export type SharingState = { sharing: boolean; endsMs: number | null };

/** Host: start sharing a plan with people right here. */
export async function startSharingPlan(
  postId: string,
  title: string,
): Promise<SharingState> {
  if (isDemoMode()) {
    const endsMs = Date.now() + 60 * 60 * 1000;
    demoSharing.set(postId, endsMs);
    return { sharing: true, endsMs };
  }
  if (!native) throw new Error(bluetoothProblem("NO_ADVERTISING"));
  await allowShare();
  if (!native.isBluetoothOn())
    throw new Error(bluetoothProblem("BLUETOOTH_OFF"));
  const { data, error } = await requireSupabase().rpc("start_plan_beacon", {
    p_post_id: postId,
  });
  if (error) throw new Error(error.message);
  const r = data as {
    ends_ms: number;
    codes: { code: string; from_ms: number; until_ms: number }[];
  };
  try {
    await native.startSharing(
      postId,
      title,
      r.codes.map((c) => ({
        code: c.code,
        fromMs: Number(c.from_ms),
        untilMs: Number(c.until_ms),
      })),
      Number(r.ends_ms),
    );
  } catch (e) {
    await requireSupabase().rpc("stop_plan_beacon", { p_post_id: postId });
    throw problem(e);
  }
  return { sharing: true, endsMs: Number(r.ends_ms) };
}

/** Host: stop sharing (also used when the phone already stopped by itself). */
export async function stopSharingPlan(postId: string): Promise<void> {
  if (isDemoMode()) {
    demoSharing.delete(postId);
    return;
  }
  try {
    if (native?.sharingPostId() === postId) native.stopSharing();
  } catch {
    // The server stop below is what matters for people looking around.
  }
  const { error } = await requireSupabase().rpc("stop_plan_beacon", {
    p_post_id: postId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Host: is this plan being shared right now? If the server thinks so but this
 * phone stopped (Stop in the notification, phone restarted), it's tidied up.
 */
export async function sharingState(postId: string): Promise<SharingState> {
  if (isDemoMode()) {
    const endsMs = demoSharing.get(postId);
    return endsMs && endsMs > Date.now()
      ? { sharing: true, endsMs }
      : { sharing: false, endsMs: null };
  }
  const { data, error } = await requireSupabase().rpc("plan_beacon_status", {
    p_post_id: postId,
  });
  if (error) return { sharing: false, endsMs: null };
  const s = data as { sharing: boolean; ends_ms: number | null };
  let onPhone = false;
  try {
    onPhone = native?.sharingPostId() === postId;
  } catch {
    onPhone = false;
  }
  if (s.sharing && !onPhone) {
    void stopSharingPlan(postId).catch(() => undefined);
    return { sharing: false, endsMs: null };
  }
  return {
    sharing: s.sharing,
    endsMs: s.ends_ms == null ? null : Number(s.ends_ms),
  };
}

const ROUNDS = 4;
const ROUND_MS = 4000;

/**
 * Listens over Bluetooth for about 16 seconds and reports the plans found
 * after each 4-second round. Looking around never broadcasts anything.
 */
export async function lookAround(
  onFound: (plans: NeedPost[]) => void,
): Promise<NeedPost[]> {
  if (isDemoMode()) {
    await new Promise((r) => setTimeout(r, 1500));
    const now = Date.now();
    const plans = mockPosts
      .filter((p) => new Date(p.startsAt).getTime() > now)
      .slice(0, 2);
    onFound(plans);
    return plans;
  }
  if (!native) throw new Error(bluetoothProblem("NO_ADVERTISING"));
  await allowScan();
  if (!native.isBluetoothOn())
    throw new Error(bluetoothProblem("BLUETOOTH_OFF"));
  const heard = new Map<string, number>();
  let plans: NeedPost[] = [];
  let lookedUp = "";
  for (let round = 0; round < ROUNDS; round++) {
    let found: HeardCode[];
    try {
      found = await native.scan(ROUND_MS);
    } catch (e) {
      throw problem(e);
    }
    const codes = heardCodes(heard, found);
    const key = codes.join(",");
    if (!codes.length || key === lookedUp) continue;
    lookedUp = key;
    const { data, error } = await requireSupabase().rpc(
      "resolve_plan_beacons",
      {
        p_codes: codes,
      },
    );
    if (error) throw new Error(error.message);
    plans = await getPostsByIds((data ?? []) as string[]);
    onFound(plans);
  }
  return plans;
}
