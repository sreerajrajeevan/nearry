import React, { useState } from "react";
import { Alert, Text, View, StyleSheet } from "react-native";
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
        <Button
          title="Report"
          variant="ghost"
          onPress={onReport}
          disabled={busy}
        />
        {!!target.userId && (
          <Button
            title="Block person"
            variant="ghost"
            onPress={() => setConfirm(!confirm)}
            disabled={busy}
          />
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
  wrap: { marginVertical: 12 },
  actions: { flexDirection: "row", gap: 12 },
  note: {
    ...typography.caption,
    color: colors.textDim,
    lineHeight: 20,
    marginVertical: 10,
  },
});
