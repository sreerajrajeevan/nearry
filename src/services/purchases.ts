import { NativeModules, Platform } from "react-native";
import type { PremiumPlanId, PurchasesAdapter } from "./premium";

const PLAN_BY_TYPE: Record<string, PremiumPlanId> = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  THREE_MONTH: "quarterly",
};

// PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR / PAYMENT_PENDING_ERROR.
const ALREADY_OWNED = "6";
const PAYMENT_PENDING = "20";

let configured = false;

/** The only module that touches react-native-purchases; null when unavailable. */
export function createRevenueCatAdapter(): PurchasesAdapter | null {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim();
  if (Platform.OS !== "android" || !apiKey) return null;
  let Purchases: any;
  try {
    Purchases = require("react-native-purchases").default;
  } catch {
    return null;
  }
  if (typeof Purchases?.configure !== "function" || !NativeModules.RNPurchases)
    return null;
  return {
    async identify(userId) {
      if (!configured) {
        Purchases.configure({ apiKey, appUserID: userId });
        configured = true;
      } else {
        await Purchases.logIn(userId);
      }
    },
    async plans() {
      const offerings = await Purchases.getOfferings();
      const out: {
        id: PremiumPlanId;
        priceString: string;
        price: number;
        pkg: unknown;
      }[] = [];
      for (const pkg of offerings.current?.availablePackages ?? []) {
        const id = PLAN_BY_TYPE[pkg.packageType];
        if (id)
          out.push({
            id,
            priceString: pkg.product.priceString,
            price: pkg.product.price,
            pkg,
          });
      }
      return out;
    },
    async purchase(pkg) {
      try {
        await Purchases.purchasePackage(pkg);
        return "done";
      } catch (e) {
        const err = e as { userCancelled?: boolean; code?: string | number };
        if (err?.userCancelled) return "cancelled";
        // Compared as strings so this does not import the SDK enum.
        const code = String(err?.code ?? "");
        if (code === ALREADY_OWNED) return "owned";
        if (code === PAYMENT_PENDING) return "pending";
        // Never show raw SDK text.
        throw new Error("Purchase didn't go through. Please try again.");
      }
    },
    async restore() {
      await Purchases.restorePurchases();
    },
    async signOut() {
      if (configured) await Purchases.logOut();
    },
  };
}
