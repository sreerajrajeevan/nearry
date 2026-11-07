import { Alert } from "../../services/appAlert";
import { PageHeading } from "../../components/PageHeading";
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { TermsAgreement } from "../../components/TermsAgreement";
import { POLICY_VERSION } from "../../utils/legal";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { colors, typography, spacing, radius } from "../../theme";
import { useAuth } from "../../store/AuthContext";
import { requestLocationPermission } from "../../services/location";

const INTERESTS = [
  "Sports",
  "Food",
  "Music",
  "Outdoors",
  "Games",
  "Culture",
  "Nightlife",
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

/** 3-step personal onboarding: interests → location → done. */
export function PersonalOnboardingScreen() {
  const { completeOnboarding, loading, profile } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [agreed, setAgreed] = useState(false);
  const agreementNeeded = profile?.termsVersion !== POLICY_VERSION;
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);

  const toggle = (item: string) =>
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );

  const enableLocation = async () => {
    setLocating(true);
    try {
      await requestLocationPermission();
    } catch {
      Alert.alert(
        "Location unavailable",
        "You can choose an area from Nearby later.",
      );
    } finally {
      setLocating(false);
      setStep(3);
    }
  };

  const progress = `0${step} / 03`;

  return (
    <Screen padded scroll keyboard>
      <PageHeading
        compact
        greeting={`Personal setup · ${progress}`}
        title={
          step === 1
            ? "What are you into?"
            : step === 2
              ? "Where are you?"
              : "You’re in."
        }
        subtitle={
          step === 1
            ? "Pick a few. We use this to surface your kind of people."
            : step === 2
              ? "Enable location to see people and places around you, or skip and choose an area later."
              : "Your people are already out there. Go find them."
        }
      />

      {step === 1 && (
        <View style={styles.body}>
          <View style={styles.chips}>
            {INTERESTS.map((item) => (
              <Chip
                key={item}
                label={item}
                selected={selected.includes(item)}
                onPress={() => toggle(item)}
              />
            ))}
          </View>
          <View style={styles.footer}>
            <Button title="Continue" onPress={() => setStep(2)} />
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.body}>
          <View style={styles.footer}>
            <Button
              title="Enable location"
              onPress={enableLocation}
              loading={locating}
            />
            <View style={styles.gap} />
            <Button title="Skip" variant="ghost" onPress={() => setStep(3)} />
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
          <View style={styles.footer}>
            {agreementNeeded && (
              <TermsAgreement
                checked={agreed}
                onChange={setAgreed}
                disabled={loading}
                onTerms={() => navigation.navigate("Legal", { page: "terms" })}
                onPrivacy={() =>
                  navigation.navigate("Legal", { page: "privacy" })
                }
              />
            )}
            <Button
              title="Start exploring"
              disabled={agreementNeeded && !agreed}
              loading={loading}
              onPress={() =>
                void completeOnboarding({
                  interests: selected,
                  termsAccepted: agreed,
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
    marginTop: spacing.sm,
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
    borderColor: colors.goldDeep,
    backgroundColor: colors.goldSoft,
  },
  chipText: {
    ...typography.label,
    color: colors.textDim,
  },
  chipTextSelected: {
    color: colors.text,
  },
  footer: {
    alignSelf: "stretch",
    marginTop: "auto",
    marginBottom: spacing.md,
  },
  gap: {
    height: spacing.sm,
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
    marginTop: spacing.sm,
    alignItems: "stretch",
    justifyContent: "flex-start",
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
