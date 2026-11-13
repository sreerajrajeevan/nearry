import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PersonalStackParamList } from "../../navigation/types";
import { OnboardingFlow } from "../onboarding/OnboardingFlow";
/** Returns to the requested plan after completion instead of losing its context. */
export function CompleteProfileScreen({
  navigation,
}: NativeStackScreenProps<PersonalStackParamList, "CompleteProfile">) {
  return <OnboardingFlow onFinished={() => navigation.goBack()} />;
}
