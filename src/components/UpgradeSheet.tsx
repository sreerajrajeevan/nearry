import React, { useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors, radius, typography, weight } from "../theme";
import { useReducedMotion } from "../store/MotionContext";
import { useToast } from "../store/ToastContext";
import { usePremium } from "../store/PremiumContext";
import { navigationRef } from "../navigation/navigationRef";
import { PremiumPlanId, PremiumReason } from "../services/premium";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { SheetGrabber, useSheetDrag } from "./SheetDrag";

const CONTEXT: Record<PremiumReason, string> = {
  plans: "You've posted 3 plans today. Free plans reset at midnight.",
  joins: "You've sent 10 join requests today. They reset at midnight.",
  filter: "See plans by who's hosting.",
  profile: "Do more on Nearry, every day.",
};
const PERKS = [
  "Unlimited plans",
  "Unlimited join requests",
  "Hosted by filter",
];
const NAMES: Record<PremiumPlanId, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "3 months",
};
const PERIOD: Record<PremiumPlanId, string> = {
  weekly: "week",
  monthly: "month",
  quarterly: "3 months",
};
const ORDER: PremiumPlanId[] = ["weekly", "monthly", "quarterly"];

export function UpgradeSheet({
  reason,
  onClose,
}: {
  reason: PremiumReason;
  onClose: () => void;
}) {
  const premium = usePremium();
  const toast = useToast();
  const drag = useSheetDrag(onClose);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<PremiumPlanId>("monthly");
  const [error, setError] = useState<string | null>(null);
  if (!premium) return null;
  const { snapshot, demo } = premium;
  const unavailable = snapshot.status === "unavailable";
  const busy = snapshot.busy;
  const plans = ORDER.map((id) =>
    snapshot.plans.find((p) => p.id === id),
  ).filter((p): p is NonNullable<typeof p> => !!p);
  const chosen = plans.find((p) => p.id === selected) ?? plans[0];
  const canBuy = !unavailable && !!chosen && snapshot.status !== "loading";
  const note = unavailable
    ? demo
      ? "Purchases are off in the demo."
      : "Premium isn't available on this device yet."
    : null;

  const buy = async () => {
    if (!chosen) return;
    setError(null);
    try {
      const result = await premium.purchase(chosen.id);
      if (result === "done") {
        toast("You're Premium 🎉");
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };
  const restore = async () => {
    setError(null);
    try {
      await premium.restore();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };
  const openLegal = (page: "privacy" | "terms") => {
    onClose();
    if (navigationRef.isReady())
      navigationRef.navigate("PersonalApp", {
        screen: "Legal",
        params: { page },
      });
  };

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Nearry Premium"
          onPress={onClose}
        />
        <SafeAreaView edges={["top", "left", "right"]} style={styles.position}>
          <Animated.View
            style={[styles.sheet, drag.style]}
            accessibilityViewIsModal
          >
            <SheetGrabber handlers={drag.handlers} />
            <View {...drag.handlers} style={styles.header}>
              <View style={styles.badge}>
                <Icon name="star" size={18} color={colors.onAmber} />
              </View>
              <Text accessibilityRole="header" style={styles.title}>
                Nearry Premium
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.close,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="x" size={22} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroller}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.context}>{CONTEXT[reason]}</Text>
              <View style={styles.perks}>
                {PERKS.map((perk) => (
                  <View key={perk} style={styles.perk}>
                    <Icon
                      name="check-circle"
                      size={18}
                      color={colors.amberDeep}
                    />
                    <Text style={styles.perkText}>{perk}</Text>
                  </View>
                ))}
              </View>
              {plans.length > 0 && (
                <View accessibilityRole="radiogroup" style={styles.plans}>
                  {plans.map((plan) => {
                    const on = chosen?.id === plan.id;
                    return (
                      <Pressable
                        key={plan.id}
                        accessibilityRole="radio"
                        accessibilityLabel={`${NAMES[plan.id]}, ${plan.priceString}${
                          plan.savingsPercent
                            ? `, save ${plan.savingsPercent}%`
                            : ""
                        }`}
                        accessibilityState={{ checked: on, disabled: busy }}
                        aria-checked={on}
                        disabled={busy}
                        onPress={() => setSelected(plan.id)}
                        style={({ pressed }) => [
                          styles.plan,
                          on && styles.planOn,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.planCopy}>
                          <View style={styles.planTop}>
                            <Text style={styles.planName}>
                              {NAMES[plan.id]}
                            </Text>
                            {plan.id === "monthly" && (
                              <View style={styles.popular}>
                                <Text style={styles.popularText}>
                                  Most popular
                                </Text>
                              </View>
                            )}
                          </View>
                          {!!plan.savingsPercent && (
                            <Text style={styles.save}>
                              Save {plan.savingsPercent}%
                            </Text>
                          )}
                        </View>
                        <Text style={styles.price}>{plan.priceString}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {!!note && <Text style={styles.note}>{note}</Text>}
              {!!chosen && !unavailable && (
                <Text style={styles.renew}>
                  Renews automatically at {chosen.priceString} per{" "}
                  {PERIOD[chosen.id]} until you cancel. Cancel anytime in Google
                  Play.
                </Text>
              )}
              <View style={styles.legal}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Read Privacy Policy"
                  onPress={() => openLegal("privacy")}
                  style={styles.link}
                >
                  <Text style={styles.linkText}>Privacy Policy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Read Terms and Community Guidelines"
                  onPress={() => openLegal("terms")}
                  style={styles.link}
                >
                  <Text style={styles.linkText}>Terms</Text>
                </Pressable>
              </View>
            </ScrollView>
            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              {!!error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              )}
              <Button
                title="Get Premium"
                variant="primary"
                disabled={!canBuy}
                loading={busy}
                onPress={() => void buy()}
              />
              <Button
                title="Restore purchases"
                variant="ghost"
                disabled={unavailable || busy}
                onPress={() => void restore()}
              />
              <Button title="Not now" variant="ghost" onPress={onClose} />
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(3,7,18,0.45)" },
  position: { flex: 1, justifyContent: "flex-end", paddingTop: 20 },
  sheet: {
    maxHeight: "96%",
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 8,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberBright,
  },
  title: { ...typography.title, color: colors.ink, flex: 1 },
  close: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  scroller: { flexShrink: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  context: { ...typography.body, color: colors.text },
  perks: { gap: 8, marginTop: 14 },
  perk: { flexDirection: "row", alignItems: "center", gap: 8 },
  perkText: { ...typography.bodySmall, color: colors.text, ...weight("600") },
  plans: { gap: 10, marginTop: 18 },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  planOn: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  planCopy: { flex: 1, minWidth: 0, gap: 2 },
  planTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  planName: { ...typography.body, color: colors.ink, ...weight("700") },
  popular: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.amber,
  },
  popularText: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.onAmber,
    ...weight("800"),
  },
  save: { ...typography.caption, color: colors.amberDeep, ...weight("700") },
  price: { ...typography.body, color: colors.ink, ...weight("800") },
  note: {
    ...typography.bodySmall,
    color: colors.amberDeep,
    marginTop: 16,
    ...weight("600"),
  },
  renew: { ...typography.caption, color: colors.textDim, marginTop: 14 },
  legal: { flexDirection: "row", columnGap: 16 },
  link: { minHeight: 44, justifyContent: "center" },
  linkText: {
    ...typography.caption,
    color: colors.amberDeep,
    textDecorationLine: "underline",
  },
  footer: {
    gap: 4,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  error: { ...typography.bodySmall, color: colors.red, textAlign: "center" },
});
