import React, { useState } from "react";
import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { colors, typography } from "../theme";
import { blockUser, ReportTarget } from "../services/safety";
import { useAuth } from "../store/AuthContext";

export function SafetyActions({
  target,
  onReport,
  onBlocked,
}: {
  target: ReportTarget;
  onReport: () => void;
  onBlocked?: () => void;
}) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  if (target.userId && target.userId === profile?.id) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Report ${target.name ?? ""}`.trim()}
          onPress={onReport}
          disabled={busy}
          hitSlop={8}
          style={styles.link}
        >
          <Icon name="flag" size={13} color={colors.textDim} />
          <Text style={styles.linkText}>Report</Text>
        </TouchableOpacity>
        {!!target.userId && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Block ${target.name ?? "this person"}`}
            accessibilityState={{ expanded: confirm }}
            onPress={() => setConfirm(!confirm)}
            disabled={busy}
            hitSlop={8}
            style={styles.link}
          >
            <Icon name="slash" size={13} color={colors.textDim} />
            <Text style={styles.linkText}>Block</Text>
          </TouchableOpacity>
        )}
      </View>
      {confirm && (
        <View>
          <Text style={styles.note}>
            Block {target.name ?? "this person"}? Their plans will be hidden and
            new messages, requests and bookings between you will stop. Existing
            commitments remain; manage them in Activity or Bookings.
          </Text>
          <Button
            title="Confirm block"
            variant="danger"
            loading={busy}
            onPress={() => {
              setBusy(true);
              void blockUser(target.userId!, true, target.name)
                .then(() => {
                  setConfirm(false);
                  onBlocked?.();
                })
                .catch((e) =>
                  setError(e instanceof Error ? e.message : "Please retry."),
                )
                .finally(() => setBusy(false));
            }}
          />
          <Button
            title="Keep unblocked"
            variant="ghost"
            disabled={busy}
            onPress={() => setConfirm(false)}
          />
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.note}>
          {error}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { marginVertical: 8 },
  actions: { flexDirection: "row", gap: 18 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
  },
  linkText: { ...typography.caption, color: colors.textDim },
  note: {
    ...typography.caption,
    color: colors.textDim,
    lineHeight: 20,
    marginVertical: 10,
  },
});
