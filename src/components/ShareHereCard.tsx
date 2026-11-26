import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { Icon } from "./Icon";
import {
  sharingState,
  startSharingPlan,
  stopSharingPlan,
  type SharingState,
} from "../services/aroundYou";
import { sharingUntilLabel } from "../utils/aroundYou";
import { colors, typography, weight } from "../theme";

/** Host's plan page: share this plan with people right here, or stop. */
export function ShareHereCard({
  postId,
  title,
}: {
  postId: string;
  title: string;
}) {
  const [state, setState] = useState<SharingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void sharingState(postId).then((s) => {
      if (live) setState(s);
    });
    return () => {
      live = false;
    };
  }, [postId]);

  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      if (state?.sharing) {
        await stopSharingPlan(postId);
        setState({ sharing: false, endsMs: null });
      } else {
        setState(await startSharingPlan(postId, title));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  const sharing = state.sharing;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon
          name="radio"
          size={22}
          color={sharing ? colors.amberDeep : colors.textDim}
        />
        <View style={styles.flex}>
          <Text style={styles.title}>
            {sharing && state.endsMs
              ? sharingUntilLabel(state.endsMs)
              : "Show to people right here"}
          </Text>
          <Text style={styles.hint}>
            {sharing
              ? "People nearby who tap Look around can see this plan. You can put your phone away."
              : "Shares this plan over Bluetooth with people in the same place. It stops on its own."}
          </Text>
        </View>
      </View>
      <Button
        title={sharing ? "Stop sharing" : "Share right here"}
        variant={sharing ? "ghost" : "secondary"}
        loading={busy}
        onPress={() => void toggle()}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  flex: { flex: 1, gap: 2 },
  title: { ...typography.heading, ...weight("800") },
  hint: { ...typography.bodySmall, color: colors.textDim },
  error: { ...typography.bodySmall, color: colors.red },
});
