import React, { useState } from "react";
import { BackHandler, Platform, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import {
  OnboardingLayout,
  OnboardingButton,
  OnboardingHero,
  OnboardingLink,
  ob,
  onboardingColors as c,
} from "../../components/onboarding/OnboardingKit";
export function IntroductionScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "Introduction">) {
  const [step, setStep] = useState(0);
  const business = route.params.accountType === "business";
  const signup = () =>
    navigation.navigate(business ? "BusinessAuth" : "PersonalAuth", {
      mode: "signup",
    });
  const back = React.useCallback(() => {
    if (step > 0) setStep(step - 1);
    else navigation.goBack();
    return true;
  }, [step, navigation]);
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === "web") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", back);
      return () => sub.remove();
    }, [back]),
  );
  const slides = business
    ? [
        [
          "Your next regular is nearby.",
          "Put your place in front of people looking for something to do.",
        ],
        [
          "Turn discovery into visits.",
          "Share what makes your place special and hear from people nearby.",
        ],
        [
          "Give them a reason to stop by.",
          "Share local offers, memberships and last-minute availability.",
        ],
      ]
    : [
        [
          "Good plans need good company.",
          "Find a game, a coffee or a little adventure around the corner.",
        ],
        [
          "A new hello is a request away.",
          "Ask to join a plan. Once the host accepts, take the conversation further.",
        ],
        [
          "Love local. Spend a little less.",
          "Discover offers from cafés, gyms and places in your neighbourhood.",
        ],
      ];
  return (
    <OnboardingLayout
      brand
      onBack={back}
      screenKey={step}
      headerAction={<OnboardingLink title="Skip" onPress={signup} />}
      footer={
        <>
          <OnboardingButton
            title={step < 2 ? "Next" : "Create my account"}
            onPress={() => (step < 2 ? setStep(step + 1) : signup())}
          />
          <OnboardingLink
            title="Already have an account? Log in"
            onPress={() =>
              navigation.navigate(business ? "BusinessAuth" : "PersonalAuth", {
                mode: "login",
              })
            }
          />
        </>
      }
    >
      <OnboardingHero
        kind={
          step === 0
            ? business
              ? "business"
              : "play"
            : step === 1
              ? "join"
              : "offers"
        }
      />
      <View
        style={styles.dots}
        accessibilityLabel={`Introduction ${step + 1} of 3`}
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i === step && styles.current]} />
        ))}
      </View>
      <Text accessibilityRole="header" style={ob.title}>
        {slides[step][0]}
      </Text>
      <Text style={ob.sub}>{slides[step][1]}</Text>
    </OnboardingLayout>
  );
}
const styles = StyleSheet.create({
  dots: { flexDirection: "row", gap: 6, marginBottom: 16 },
  dot: { width: 5, height: 5, borderRadius: 10, backgroundColor: c.line },
  current: { width: 22, backgroundColor: c.bright },
});
