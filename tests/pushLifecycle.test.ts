import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("native push lifecycle: logout during registration revokes after commit, offline cleanup survives and account switching is safe", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nearry-push-test-"));
  const values = new Map<string, string>(),
    server = new Map<string, { user: string; secret: string }>();
  let owner = "alice",
    release: (() => void) | undefined,
    entered: (() => void) | undefined,
    hold = false,
    offline = false,
    counter = 0;
  const storage = {
    getItem: async (k: string) => values.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: async (k: string) => {
      values.delete(k);
    },
  };
  const db: any = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: owner } } } }),
    },
    rpc: async (name: string, args: any) => {
      if (name === "register_push_installation") {
        const registeringOwner = owner;
        if (hold) {
          entered?.();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        server.set(args.p_token, {
          user: registeringOwner,
          secret: args.p_secret,
        });
        return { error: null };
      }
      if (name === "revoke_push_installation") {
        if (offline) return { error: { message: "offline" } };
        if (server.get(args.p_token)?.secret === args.p_secret)
          server.delete(args.p_token);
        return { error: null };
      }
      throw new Error("Unexpected RPC " + name);
    },
  };
  (globalThis as any).__nearryPushFixture = {
    storage,
    db,
    random: () => ++counter,
  };
  const mocks: Record<string, string> = {
    "@react-native-async-storage/async-storage":
      "export default globalThis.__nearryPushFixture.storage;",
    "@supabase/supabase-js":
      "export const createClient=()=>globalThis.__nearryPushFixture.db;",
    "expo-crypto":
      "export const getRandomBytes=n=>new Uint8Array(n).fill(globalThis.__nearryPushFixture.random());",
    "expo-constants":
      "export default {expoConfig:{extra:{eas:{projectId:'test-project'}}}};",
    "expo-device": "export const isDevice=true;",
    "react-native":
      "export const Platform={OS:'android'};export const AppState={currentState:'active'};",
    "expo-notifications":
      "export const requestPermissionsAsync=async()=>({status:'granted'});export const scheduleNotificationAsync=async()=>{};export const setNotificationHandler=()=>{};export const AndroidImportance={DEFAULT:3};export const setNotificationChannelAsync=async()=>{};export const getPermissionsAsync=async()=>({status:'granted'});export const getExpoPushTokenAsync=async()=>({data:'ExpoPushToken[test-installation]'});",
    "./authStorage":
      "export const authStorage=globalThis.__nearryPushFixture.storage;",
    "./supabase":
      "export const getSupabase=()=>globalThis.__nearryPushFixture.db;export const isSupabaseConfigured=true;export const isDemoMode=()=>false;",
    "./safety":
      "export const notificationPreferences=async()=>({pushEnabled:true});export const setPushEnabled=async()=>{};",
    "./realtime": "export const multiplexSubscribe=()=>()=>{};",
    "../data/mock": "export const mockNotifications=[];",
  };
  try {
    const result = await build({
      entryPoints: ["src/services/notifications.ts"],
      bundle: true,
      write: false,
      platform: "node",
      format: "esm",
      tsconfigRaw: {},
      define: {
        "process.env.EXPO_PUBLIC_SUPABASE_URL": JSON.stringify(
          "https://push-test.invalid",
        ),
        "process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY":
          JSON.stringify("test-public-key"),
      },
      plugins: [
        {
          name: "native-fixture",
          setup(b) {
            b.onResolve({ filter: /.*/ }, (args) =>
              args.path in mocks
                ? { path: args.path, namespace: "fixture" }
                : undefined,
            );
            b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
              contents: mocks[args.path],
              loader: "js",
            }));
          },
        },
      ],
    });
    const file = join(directory, "push.mjs");
    await writeFile(file, result.outputFiles[0].text);
    const push = await import(pathToFileURL(file).href);
    hold = true;
    const arrived = new Promise<void>((r) => {
      entered = r;
    });
    const registration = push.registerPushToken(owner);
    await arrived;
    const logout = push.unregisterPushToken();
    release!();
    await Promise.all([registration, logout]);
    assert.equal(server.size, 0);
    hold = false;
    await push.registerPushToken(owner);
    assert.equal(server.size, 1);
    offline = true;
    await assert.rejects(push.unregisterPushToken(), /retry/);
    assert.equal(server.size, 1);
    assert.ok([...values.values()].some((v) => v.includes('"pending":true')));
    owner = "bob";
    offline = false;
    await push.registerPushToken(owner);
    assert.equal(server.get("ExpoPushToken[test-installation]")?.user, "bob");
    // A stale queued cleanup cannot remove the newly registered owner.
    await push.retryPendingPushCleanup();
    assert.equal(server.size, 1);
    await push.unregisterPushToken();
    assert.equal(server.size, 0);
  } finally {
    delete (globalThis as any).__nearryPushFixture;
    await rm(directory, { recursive: true, force: true });
  }
});
