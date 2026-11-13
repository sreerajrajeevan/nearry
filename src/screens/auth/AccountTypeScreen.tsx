import React, { useState } from "react";
import { Text } from "react-native";
import { useAuth } from "../../store/AuthContext";
import { AccountType } from "../../navigation/types";
import {
  OnboardingLayout,
  OnboardingHero,
  OnboardingHeading,
  OnboardingRoleChoice,
  OnboardingButton,
  OnboardingLink,
  ob,
} from "../../components/onboarding/OnboardingKit";
export function AccountTypeScreen() {
  const { selectAccountType, loading, intendedRole, signOut } = useAuth();
  const [role, setRole] = useState<AccountType>(intendedRole);
  const [error, setError] = useState("");
  const choose = async () => {
    setError("");
    try {
      await selectAccountType(role);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  };
  return (
    <OnboardingLayout
      brand
      footer={
        <>
          <OnboardingButton
            title="Continue"
            onPress={() => void choose()}
            loading={loading}
          />
          <OnboardingLink
            title="Use a different account"
            disabled={loading}
            onPress={() => void signOut().catch((e) => setError(e.message))}
          />
        </>
      }
    >
      <OnboardingHero kind="welcome" compact />
      <OnboardingHeading
        kicker="A place for you"
        title="How will you use Nearry?"
        subtitle="Confirm your account type to finish setting up your space."
      />
      <OnboardingRoleChoice role={role} onChange={setRole} disabled={loading} />
      {!!error && (
        <Text accessibilityRole="alert" style={ob.error}>
          {error}
        </Text>
      )}
    </OnboardingLayout>
  );
}
