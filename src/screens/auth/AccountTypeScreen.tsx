import React, { useState } from "react";
import { Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { useAuth } from "../../store/AuthContext";
import { colors, typography, spacing } from "../../theme";
export function AccountTypeScreen() {
  const { selectAccountType, loading, intendedRole } = useAuth();
  const [error, setError] = useState("");
  async function choose(role: "personal" | "business") {
    setError("");
    try {
      await selectAccountType(role);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    }
  }
  return (
    <Screen padded>
      <Text style={{ ...typography.title, color: colors.text }}>
        How will you use Nearry?
      </Text>
      <Text
        style={{
          ...typography.body,
          color: colors.textDim,
          marginVertical: spacing.lg,
        }}
      >
        Choose your account type to finish setup. Your suggested choice is{" "}
        {intendedRole}.
      </Text>
      <Button
        title="Personal"
        loading={loading}
        onPress={() => void choose("personal")}
      />
      <View style={{ height: spacing.md }} />
      <Button
        title="Business"
        loading={loading}
        onPress={() => void choose("business")}
      />
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.red, marginTop: spacing.md }}
        >
          {error}
        </Text>
      )}
    </Screen>
  );
}
