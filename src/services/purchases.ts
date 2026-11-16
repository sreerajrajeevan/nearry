import { NativeModules, Platform } from "react-native";
import type { PremiumPlanId, PurchasesAdapter } from "./premium";

const PLAN_BY_TYPE: Record<string, PremiumPlanId> = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  THREE_MONTH: "quarterly",
};

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
        if ((e as { userCancelled?: boolean })?.userCancelled)
          return "cancelled";
        throw e;
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
