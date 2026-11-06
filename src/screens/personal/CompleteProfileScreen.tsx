import React, { useRef, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonalStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { PageHeading } from "../../components/PageHeading";
import { TermsAgreement } from "../../components/TermsAgreement";
import { useAuth } from "../../store/AuthContext";
import { validatePersonalDetails } from "../../utils/profileReadiness";
import { POLICY_VERSION } from "../../utils/legal";
import { colors, typography } from "../../theme";
export function CompleteProfileScreen({
  navigation,
}: NativeStackScreenProps<PersonalStackParamList, "CompleteProfile">) {
  const { profile, savePersonalProfile } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [gender, setGender] = useState(profile?.gender);
  const [age, setAge] = useState(profile?.age?.toString() ?? "");
  const [agreed, setAgreed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const needsAgreement = profile?.termsVersion !== POLICY_VERSION;
  const save = async () => {
    if (lock.current) return;
    const invalid = validatePersonalDetails(name, gender, age);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (needsAgreement && !agreed) {
      setError("Please confirm you’re 18 or older and agree to the terms.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await savePersonalProfile({
        displayName: name.trim(),
        gender: gender!,
        age: Number(age),
        termsAccepted: agreed,
      });
      navigation.goBack();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save your profile. Please retry.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen scroll keyboard style={styles.page}>
      <Button
        title="Back"
        variant="ghost"
        disabled={busy}
        onPress={() => navigation.goBack()}
      />
      <PageHeading
        title="Make yourself known"
        greeting="Your first hello starts here."
      />
      <Input
        label="Your name"
        value={name}
        onChangeText={setName}
        maxLength={40}
        editable={!busy}
      />
      <Text style={styles.label}>Gender</Text>
      <View style={styles.row}>
        {(
          [
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
            { value: "other", label: "Other" },
          ] as const
        ).map((g) => (
          <Button
            key={g.value}
            title={g.label}
            variant={gender === g.value ? "primary" : "secondary"}
            disabled={busy}
            onPress={() => setGender(g.value)}
          />
        ))}
      </View>
      <Input
        label="Age"
        placeholder="18 or older"
        value={age}
        onChangeText={(s) => setAge(s.replace(/\D/g, ""))}
        maxLength={3}
        keyboardType="number-pad"
        editable={!busy}
      />
      <Text style={styles.copy}>
        Your age is private. Gender helps us check whether a plan’s audience
        includes you.
      </Text>
      {needsAgreement && (
        <TermsAgreement
          checked={agreed}
          onChange={setAgreed}
          disabled={busy}
          onTerms={() => navigation.navigate("Legal", { page: "terms" })}
          onPrivacy={() => navigation.navigate("Legal", { page: "privacy" })}
        />
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button title="Save profile" loading={busy} onPress={() => void save()} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  page: { gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  label: { ...typography.body, color: colors.text },
  copy: { ...typography.bodySmall, color: colors.textDim },
  error: { ...typography.bodySmall, color: colors.red },
});
