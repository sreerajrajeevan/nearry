import { requireSupabase } from "./supabase";
import { POLICY_VERSION } from "../utils/legal";

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type Flow = "email" | "google";
type Intent = {
  id: string;
  flow: Flow;
  email?: string;
  version: string;
  created: number;
};
const KEY = "nearry.signupAgreement";
const MAX_AGE = 60 * 60 * 1000;
export const AGREEMENT_REQUIRED =
  "Please confirm you’re 18 or older and agree to the Terms & Community Guidelines.";

/** Only an explicit signup action creates an intent. Session restoration never consumes one. */
export class SignupAgreementStore {
  private pending = new Map<string, Promise<boolean>>();
  constructor(
    private storage: Storage,
    private accept: (userId: string) => Promise<void>,
    private clock = Date.now,
  ) {}
  async begin(flow: Flow, agreed: boolean, email?: string) {
    if (agreed !== true) throw new Error(AGREEMENT_REQUIRED);
    const intent: Intent = {
      id: `${this.clock()}-${Math.random().toString(36).slice(2)}`,
      flow,
      version: POLICY_VERSION,
      created: this.clock(),
      ...(flow === "email" ? { email: email?.trim().toLowerCase() } : {}),
    };
    await this.storage.setItem(KEY, JSON.stringify(intent));
  }
  async clear() {
    await this.storage.removeItem(KEY);
  }
  private async clearIfCurrent(raw: string) {
    if ((await this.storage.getItem(KEY)) === raw) await this.clear();
  }
  async complete(flow: Flow, userId: string, email?: string): Promise<boolean> {
    const raw = await this.storage.getItem(KEY);
    if (!raw) return false;
    let intent: Intent;
    try {
      intent = JSON.parse(raw);
    } catch {
      await this.clearIfCurrent(raw);
      return false;
    }
    if (
      !intent ||
      typeof intent.id !== "string" ||
      !intent.id ||
      intent.version !== POLICY_VERSION ||
      !Number.isFinite(intent.created) ||
      intent.created > this.clock() ||
      this.clock() - intent.created > MAX_AGE
    ) {
      await this.clearIfCurrent(raw);
      return false;
    }
    if (
      intent.flow !== flow ||
      (flow === "email" &&
        (!email || intent.email !== email.trim().toLowerCase()))
    )
      return false;
    const key = `${intent.id}:${userId}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const work = (async () => {
      await this.accept(userId);
      await this.clearIfCurrent(raw);
      return true;
    })();
    this.pending.set(key, work);
    try {
      return await work;
    } finally {
      this.pending.delete(key);
    }
  }
}

/** The database records the authenticated account, policy version and server timestamp. */
export async function acceptCurrentTerms(expectedUserId?: string) {
  const db = requireSupabase();
  if (expectedUserId) {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== expectedUserId)
      throw new Error("Account changed. Please retry.");
  }
  const { error } = await db.rpc("accept_community_terms", {
    p_version: POLICY_VERSION,
    p_adult: true,
  });
  if (error) throw error;
}
let store: SignupAgreementStore | undefined;
export function configureSignupAgreementStorage(storage: Storage) {
  store = new SignupAgreementStore(storage, acceptCurrentTerms);
}
export function beginSignupAgreement(
  flow: Flow,
  agreed: boolean,
  email?: string,
) {
  if (!store)
    throw new Error("Account storage is not ready. Please restart the app.");
  return store.begin(flow, agreed, email);
}
export async function clearSignupAgreement() {
  await store?.clear();
}
export async function completeSignupAgreement(
  flow: Flow,
  userId: string,
  email?: string,
) {
  return (await store?.complete(flow, userId, email)) ?? false;
}
