import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { colors, typography, spacing, radius } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { requestLocationPermission } from "../../services/location";

const CATEGORIES = [
  "Café",
  "Restaurant",
  "Games",
  "Culture",
  "Fitness",
  "Retail",
];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** 3-step business onboarding: profile → location → done. */
export function BusinessOnboardingScreen() {
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [locating, setLocating] = useState(false);

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const granted = await requestLocationPermission();
      if (granted) setArea("Current location");
    } finally {
      setLocating(false);
    }
  };

  const progress = `0${step} / 03`;

  return (
    <Screen padded scroll keyboard>
      <Text style={styles.progress}>{progress}</Text>

      {step === 1 && (
        <View style={styles.body}>
          <Text style={styles.title}>Tell us about your place</Text>
          <Text style={styles.sub}>This is how explorers will find you.</Text>
          <Input
            label="Business name"
            placeholder="e.g. Neon Arena"
            value={businessName}
            onChangeText={setBusinessName}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={category === item}
                onPress={() => setCategory(item)}
              />
            ))}
          </View>
          <View style={styles.footer}>
            <Button
              title="Continue"
              disabled={businessName.trim().length < 2 || !category}
              onPress={() => setStep(2)}
            />
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.body}>
          <Text style={styles.title}>Where is it?</Text>
          <Text style={styles.sub}>
            Set your area so nearby explorers can discover you.
          </Text>
          <Input
            label="Area / locality"
            placeholder="e.g. Indiranagar, Bengaluru"
            value={area}
            onChangeText={setArea}
            autoCapitalize="words"
            returnKeyType="done"
          />
          <Button
            title="Use current location"
            variant="ghost"
            onPress={useCurrentLocation}
            loading={locating}
          />
          <View style={styles.footer}>
            <Button
              title="Continue"
              disabled={!area.trim()}
              onPress={() => setStep(3)}
            />
          </View>
          <TouchableOpacity
            onPress={() => setStep(1)}
            style={styles.back}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 3 && (
        <View style={styles.done}>
          <Text style={styles.doneTitle}>
            Ready to meet your neighbourhood<Text style={styles.dot}>.</Text>
          </Text>
          <Text style={styles.sub}>
            Post offers, take bookings, watch footfall grow.
          </Text>
          <View style={styles.footerWide}>
            <Button
              title="Open dashboard"
              onPress={() =>
                void completeOnboarding({
                  businessName: businessName.trim(),
                  businessDetails: { category, area: area.trim() },
                }).catch((e) =>
                  Alert.alert(
                    "Could not save profile",
                    e instanceof Error ? e.message : "Please retry.",
                  ),
                )
              }
            />
          </View>
          <TouchableOpacity
            onPress={() => setStep(2)}
            style={styles.back}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    ...typography.label,
    color: colors.textFaint,
    marginTop: spacing.md,
  },
  body: {
    flex: 1,
    marginTop: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textDim,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.red,
  },
  chipText: {
    ...typography.label,
    color: colors.textDim,
  },
  chipTextSelected: {
    color: colors.text,
  },
  footer: {
    marginTop: "auto",
    marginBottom: spacing.md,
  },
  footerWide: {
    marginTop: spacing.xl,
    width: "100%",
  },
  back: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  backText: {
    ...typography.label,
    color: colors.textFaint,
  },
  done: {
    flex: 1,
    marginTop: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    ...typography.display,
    color: colors.text,
    textAlign: "center",
  },
  dot: {
    color: colors.red,
  },
});
