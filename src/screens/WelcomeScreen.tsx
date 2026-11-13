import React, { useState } from "react";
import { Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, AccountType } from "../navigation/types";
import { useAuth } from "../store/AuthContext";
import {
  OnboardingLayout,
  OnboardingHeading,
  OnboardingHero,
  OnboardingRoleChoice,
  OnboardingButton,
  OnboardingLink,
  ob,
} from "../components/onboarding/OnboardingKit";

export function WelcomeScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Welcome">) {
  const { enterDemoMode } = useAuth();
  const [role, setRole] = useState<AccountType | null>(null);
  const [demos, setDemos] = useState(false);
  return (
    <OnboardingLayout
      brand
      screenKey="choice"
      headerAction={
        <OnboardingLink title="Preview" onPress={() => setDemos(!demos)} />
      }
      footer={
        <>
          <OnboardingButton
            title="Let’s get started"
            disabled={!role}
            onPress={() =>
              role && navigation.navigate("Introduction", { accountType: role })
            }
          />
          <OnboardingLink
            title="Already have an account? Log in"
            onPress={() =>
              navigation.navigate(
                role === "business" ? "BusinessAuth" : "PersonalAuth",
                { mode: "login" },
              )
            }
          />
        </>
      }
    >
      <OnboardingHero kind="welcome" compact />
      <OnboardingHeading
        kicker="Good things happen nearby"
        title={"Your neighbourhood.\nYour kind of people."}
        subtitle="How would you like to use Nearry?"
      />
      <OnboardingRoleChoice role={role} onChange={setRole} />
      {demos && (
        <View style={{ marginTop: 22 }}>
          <Text style={ob.help}>
            Demos contain sample data. No account needed.
          </Text>
          <OnboardingLink
            title="Personal demo"
            onPress={() => enterDemoMode("personal")}
          />
          <OnboardingLink
            title="Business demo"
            onPress={() => enterDemoMode("business")}
          />
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          marginTop: 14,
        }}
      >
        <OnboardingLink
          title="Privacy Policy"
          onPress={() => navigation.navigate("Legal", { page: "privacy" })}
        />
        <OnboardingLink
          title="Terms & Community Guidelines"
          onPress={() => navigation.navigate("Legal", { page: "terms" })}
        />
      </View>
    </OnboardingLayout>
  );
}
