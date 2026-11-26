import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { LoadingDots } from "./LoadingDots";
import { PostRow } from "./PostRow";
import { lookAround } from "../services/aroundYou";
import type { NeedPost } from "../services/mappers";
import { colors, typography, weight } from "../theme";

type Phase = "idle" | "looking" | "done" | "error";

/**
 * Discover: "Plans around you". Listens over Bluetooth for plans that hosts
 * in the same place are sharing. Looking never makes the person visible.
 */
export function AroundYouCard({
  onOpen,
  onPost,
}: {
  onOpen: (postId: string) => void;
  onPost: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [plans, setPlans] = useState<NeedPost[]>([]);
  const [error, setError] = useState("");
  const running = useRef(false);

  const look = async () => {
    if (running.current) return;
    running.current = true;
    setPhase("looking");
    setPlans([]);
    setError("");
    try {
      const found = await lookAround((p) => setPlans(p));
      setPlans(found);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setPhase("error");
    } finally {
      running.current = false;
    }
  };

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Plans around you
      </Text>
      <View style={styles.card}>
        <View style={styles.top}>
          <View style={styles.badge}>
            <Icon name="radio" size={20} color={colors.onAmber} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.cardTitle}>
              {phase === "looking"
                ? "Looking around…"
                : phase === "done" && plans.length > 0
                  ? `${plans.length} ${plans.length === 1 ? "plan" : "plans"} right here`
                  : "In a mall, café or gym?"}
            </Text>
            <Text style={styles.hint}>
              {phase === "looking"
                ? "Keep Nearry open for a few seconds."
                : "See plans people are sharing right here, over Bluetooth. Nobody sees you looking."}
            </Text>
          </View>
        </View>
        {phase === "looking" ? (
          <View style={styles.loading} accessibilityLabel="Looking around">
            <LoadingDots color={colors.amber} />
          </View>
        ) : (
          <Button
            title={phase === "idle" ? "Look around" : "Look again"}
            onPress={() => void look()}
          />
        )}
      </View>
      {phase === "error" && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {plans.length > 0 && (
        <View style={styles.results}>
          {plans.map((p) => (
            <PostRow key={p.id} post={p} onPress={() => onOpen(p.id)} />
          ))}
        </View>
      )}
      {phase === "done" && plans.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No plans around you right now.</Text>
          <Text style={styles.emptyHint}>
            Post one and share it with people right here.
          </Text>
          <Button title="Post a plan" variant="secondary" onPress={onPost} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8, marginBottom: 20, gap: 12 },
  title: { ...typography.heading, fontSize: 20, ...weight("800") },
  card: {
    borderRadius: 20,
    backgroundColor: colors.night,
    padding: 16,
    gap: 14,
  },
  top: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 4 },
  cardTitle: {
    fontSize: 16,
    lineHeight: 21,
    color: colors.white,
    ...weight("800"),
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.78)",
    ...weight("500"),
  },
  loading: { height: 48, alignItems: "center", justifyContent: "center" },
  error: { ...typography.bodySmall, color: colors.red },
  results: { gap: 12 },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: 16,
    gap: 6,
  },
  emptyTitle: { ...typography.heading },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: 6,
  },
});
