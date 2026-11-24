import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { colors, typography, weight } from "../theme";
import { reminderStatusText, type TodayPlan } from "../utils/planReminders";

const timeOf = (iso: string) =>
  new Date(iso)
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    .toLowerCase();

/**
 * "Plans for today": shown when the app opens on a day with plans. Members
 * answer Going / Not going; hosts see how many confirmed.
 */
export function TodayPlansSheet({
  plans,
  busy,
  onGoing,
  onNotGoing,
  onOpen,
  onClose,
}: {
  plans: TodayPlan[];
  busy: string | null;
  onGoing: (plan: TodayPlan) => void;
  onNotGoing: (plan: TodayPlan) => void;
  onOpen: (plan: TodayPlan) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={plans.length > 0}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
        />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {plans.length === 1
                ? "Your plan for today"
                : "Your plans for today"}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.close}
            >
              <Icon name="x" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {plans.map((plan) => (
              <View key={plan.postId} style={styles.card}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${plan.title}, ${timeOf(plan.startsAt)}${plan.place ? ` at ${plan.place}` : ""}. Open plan`}
                  onPress={() => onOpen(plan)}
                  style={styles.cardTop}
                >
                  <View style={styles.timeTile}>
                    <Text style={styles.timeText}>{timeOf(plan.startsAt)}</Text>
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.planTitle} numberOfLines={1}>
                      {plan.title}
                    </Text>
                    {!!plan.place && (
                      <Text style={styles.place} numberOfLines={1}>
                        {plan.place}
                      </Text>
                    )}
                    <Text style={styles.status}>
                      {reminderStatusText(plan)}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textDim} />
                </TouchableOpacity>
                {!plan.host && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Not going to ${plan.title}`}
                      disabled={!!busy}
                      onPress={() => onNotGoing(plan)}
                      style={[styles.action, styles.notGoing]}
                    >
                      <Text style={styles.notGoingText}>Not going</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Going to ${plan.title}`}
                      accessibilityState={{ busy: busy === plan.postId }}
                      disabled={!!busy}
                      onPress={() => onGoing(plan)}
                      style={[styles.action, styles.going]}
                    >
                      <Icon name="check" size={16} color={colors.onAmber} />
                      <Text style={styles.goingText}>Going</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheet: {
    maxHeight: "80%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 20, ...weight("800"), color: colors.text },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
  list: { gap: 12, paddingBottom: 8 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeTile: {
    minWidth: 64,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
  },
  timeText: { fontSize: 14, ...weight("800"), color: colors.text },
  cardCopy: { flex: 1, minWidth: 0 },
  planTitle: { ...typography.body, ...weight("700"), color: colors.text },
  place: { ...typography.bodySmall, color: colors.textDim, marginTop: 2 },
  status: {
    ...typography.caption,
    ...weight("700"),
    color: colors.amberDeep,
    marginTop: 4,
  },
  actions: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  notGoing: { borderWidth: 1, borderColor: colors.border },
  notGoingText: { ...typography.label, color: colors.text },
  going: { backgroundColor: colors.amberBright },
  goingText: { ...typography.label, color: colors.onAmber },
});
