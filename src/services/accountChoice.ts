import type { AccountType } from "../navigation/types";
import type { Profile } from "./mappers";

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type Choice = {
  version: 1;
  id: string;
  role: AccountType;
  flow: "email" | "google";
  email?: string;
  created: number;
};
const KEY = "nearry.accountChoice";
const MAX_AGE = 60 * 60 * 1000;
const normalizeEmail = (email?: string) => email?.trim().toLowerCase();

/** Carries an explicit pre-login choice through OAuth redirects, never consent. */
export class AccountChoiceStore {
  private pending = new Map<string, Promise<Profile>>();
  constructor(
    private storage: Storage,
    private clock = Date.now,
  ) {}

  async begin(role: AccountType, flow: Choice["flow"], email?: string) {
    const choice: Choice = {
      version: 1,
      id: `${this.clock()}-${Math.random().toString(36).slice(2)}`,
      role,
      flow,
      created: this.clock(),
      ...(flow === "email" ? { email: normalizeEmail(email) } : {}),
    };
    await this.storage.setItem(KEY, JSON.stringify(choice));
  }
  async clear() {
    await this.storage.removeItem(KEY);
  }
  private async clearIfCurrent(raw: string) {
    if ((await this.storage.getItem(KEY)) === raw) await this.clear();
  }

  async resolve(
    profile: Profile,
    user: { id: string; email?: string },
    io: {
      isCurrent: () => boolean;
      select: (role: AccountType) => Promise<void>;
      read: () => Promise<Profile>;
    },
  ): Promise<Profile> {
    if (profile.id !== user.id)
      throw new Error("Account changed. Please retry.");
    const raw = await this.storage.getItem(KEY);
    if (!raw || !io.isCurrent()) return profile;
    let choice: Choice;
    try {
      choice = JSON.parse(raw);
    } catch {
      await this.clearIfCurrent(raw);
      return profile;
    }
    if (
      !choice ||
      choice.version !== 1 ||
      typeof choice.id !== "string" ||
      !choice.id ||
      !["personal", "business"].includes(choice.role) ||
      !["email", "google"].includes(choice.flow) ||
      !Number.isFinite(choice.created) ||
      choice.created > this.clock() ||
      this.clock() - choice.created > MAX_AGE
    ) {
      await this.clearIfCurrent(raw);
      return profile;
    }
    if (
      choice.flow === "email" &&
      (!user.email || choice.email !== normalizeEmail(user.email))
    )
      return profile;

    const key = `${choice.id}:${user.id}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const work = (async () => {
      // A returning account's saved type always wins over the login lane.
      if (profile.roleSelected || profile.onboardingCompleted) {
        await this.clearIfCurrent(raw);
        return profile;
      }
      if ((await this.storage.getItem(KEY)) !== raw || !io.isCurrent())
        return profile;
      let saved: Profile;
      try {
        await io.select(choice.role);
      } catch (error) {
        if (!io.isCurrent()) throw error;
        // Another auth callback/device may already have selected a type.
        saved = await io.read();
        if (saved.id !== user.id || !saved.roleSelected) throw error;
        await this.clearIfCurrent(raw);
        return saved;
      }
      if (!io.isCurrent()) throw new Error("Account changed. Please retry.");
      saved = await io.read();
      if (saved.id !== user.id || !saved.roleSelected)
        throw new Error("Could not save your account type. Please retry.");
      await this.clearIfCurrent(raw);
      return saved;
    })();
    this.pending.set(key, work);
    try {
      return await work;
    } finally {
      this.pending.delete(key);
    }
  }
}
