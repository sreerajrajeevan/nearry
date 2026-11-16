export type PremiumReason = "plans" | "joins" | "filter" | "profile";
export type PremiumPlanId = "weekly" | "monthly" | "quarterly";
export type PremiumPlan = {
  id: PremiumPlanId;
  priceString: string;
  price: number;
  savingsPercent: number | null;
  pkg: unknown;
};
export type PremiumSnapshot = {
  status: "loading" | "free" | "premium" | "unavailable";
  expiresAt: string | null;
  plans: PremiumPlan[];
  busy: boolean;
};
export interface PurchasesAdapter {
  identify(userId: string): Promise<void>;
  plans(): Promise<Omit<PremiumPlan, "savingsPercent">[]>;
  purchase(pkg: unknown): Promise<"done" | "cancelled">;
  restore(): Promise<void>;
  signOut(): Promise<void>;
}

/** Maps a server error message from the premium gates to the paywall reason. */
export function premiumBlock(message: string): PremiumReason | null {
  if (message.includes("daily_plan_limit")) return "plans";
  if (message.includes("daily_join_limit")) return "joins";
  if (message.includes("premium_required")) return "filter";
  return null;
}

const WEEKS: Record<PremiumPlanId, number> = {
  weekly: 1,
  monthly: 52 / 12,
  quarterly: 13,
};

/** Percent saved versus paying weekly for the same period, rounded to the nearest percent. */
export function planSavings(plans: PremiumPlan[]): PremiumPlan[] {
  const weekly = plans.find((p) => p.id === "weekly");
  return plans.map((p) => {
    if (p.id === "weekly" || !weekly || !(weekly.price > 0))
      return { ...p, savingsPercent: null };
    const full = weekly.price * WEEKS[p.id];
    const pct = Math.round(((full - p.price) / full) * 100);
    return { ...p, savingsPercent: pct > 0 ? pct : null };
  });
}

const CONFIRMING =
  "Your purchase went through. We're still confirming it — tap Restore in a minute.";

type Deps = {
  adapter: PurchasesAdapter | null;
  userId: string;
  demo: boolean;
  readExpiry(): Promise<string | null>;
  sync(): Promise<string | null>;
  now?: () => Date;
};

export class PremiumStore {
  private state: PremiumSnapshot = {
    status: "loading",
    expiresAt: null,
    plans: [],
    busy: false,
  };
  private listeners = new Set<() => void>();
  constructor(private deps: Deps) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<PremiumSnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  private epoch = 0;
  private broken = false;
  private isFuture(expiresAt: string | null) {
    const t = expiresAt ? Date.parse(expiresAt) : NaN;
    const now = (this.deps.now ?? (() => new Date()))().getTime();
    return Number.isFinite(t) && t > now;
  }
  private statusFor(expiresAt: string | null): PremiumSnapshot["status"] {
    if (this.isFuture(expiresAt)) return "premium";
    return !this.deps.adapter || this.deps.demo || this.broken
      ? "unavailable"
      : "free";
  }
  private apply(expiresAt: string | null) {
    this.publish({ expiresAt, status: this.statusFor(expiresAt) });
  }
  load = async (): Promise<void> => {
    const { adapter, demo, userId } = this.deps;
    const epoch = this.epoch;
    let expiry: string | null = null;
    let failed = false;
    try {
      expiry = await this.deps.readExpiry();
    } catch {
      failed = true;
    }
    // A purchase/restore confirmation finished meanwhile; its expiry is newer.
    if (epoch === this.epoch) {
      if (!failed) this.apply(expiry);
      else if (this.state.status === "loading") this.apply(null);
    }
    if (!adapter || demo) return;
    try {
      await adapter.identify(userId);
    } catch {
      this.broken = true;
      this.apply(this.state.expiresAt);
      return;
    }
    this.broken = false;
    this.apply(this.state.expiresAt);
    try {
      const plans = planSavings(
        (await adapter.plans()).map((p) => ({ ...p, savingsPercent: null })),
      );
      this.publish({ plans });
    } catch {
      // Plans stay empty; the paywall shows an unavailable state.
    }
  };
  private async confirm(requireActive: boolean) {
    let expiry: string | null;
    try {
      expiry = await this.deps.sync();
    } catch {
      throw new Error(CONFIRMING);
    }
    if (requireActive && !this.isFuture(expiry)) throw new Error(CONFIRMING);
    this.epoch++;
    this.apply(expiry);
  }
  purchase = async (id: PremiumPlanId): Promise<"done" | "cancelled"> => {
    const { adapter, demo } = this.deps;
    if (!adapter || demo)
      throw new Error("Premium purchases aren't available right now.");
    const plan = this.state.plans.find((p) => p.id === id);
    if (!plan) throw new Error("That plan isn't available right now.");
    if (this.state.busy) throw new Error("Please wait a moment.");
    this.publish({ busy: true });
    try {
      const result = await adapter.purchase(plan.pkg);
      if (result === "done") await this.confirm(true);
      return result;
    } finally {
      this.publish({ busy: false });
    }
  };
  restore = async (): Promise<void> => {
    const { adapter, demo } = this.deps;
    if (!adapter || demo)
      throw new Error("Restoring purchases isn't available right now.");
    if (this.state.busy) return;
    this.publish({ busy: true });
    try {
      await adapter.restore();
      await this.confirm(false);
    } finally {
      this.publish({ busy: false });
    }
  };
}

/** Reads the signed-in user's entitlement expiry (RLS limits this to their own row). */
export async function readPremiumExpiry(
  client: {
    from(t: string): any;
  },
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("premium_entitlements")
    .select("expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.expires_at as string | null) ?? null;
}

/** Asks the server to re-verify with RevenueCat and returns the new expiry. */
export async function syncPremium(client: {
  functions: { invoke(n: string, o: unknown): Promise<any> };
}): Promise<string | null> {
  const { data, error } = await client.functions.invoke("revenuecat-webhook", {
    body: { action: "sync" },
  });
  if (error) throw error;
  return (data?.expires_at as string | null) ?? null;
}
