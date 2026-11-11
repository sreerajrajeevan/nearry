import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { BrandLogo } from "../components/BrandLogo";
import { CoastalHero } from "../components/CoastalHero";
import { Button } from "../components/Button";
import { MotionPressable } from "../components/Motion";
import { Icon } from "../components/Icon";
import { colors, typography } from "../theme";
import { RootStackParamList } from "../navigation/types";
import { useAuth } from "../store/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;
export function WelcomeScreen({ navigation }: Props) {
  const { enterDemoMode } = useAuth();
  return (
    <Screen padded={false} brandTop>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <CoastalHero>
          <View style={styles.brand}>
            <BrandLogo
              width={175}
              color={colors.white}
              dotColor={colors.white}
            />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>DISCOVER · PLAN · MEET NEARBY</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Good plans.{"\n"}
              <Text style={styles.highlight}>Even better{"\n"}company.</Text>
            </Text>
            <Text style={styles.description}>
              A game after work. Coffee with someone new. Find your people,
              right around you.
            </Text>
          </View>
        </CoastalHero>
        <View style={styles.body}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Your neighbourhood awaits.
          </Text>
          <Button
            title="Let’s find a plan"
            onPress={() =>
              navigation.navigate("PersonalAuth", { mode: "login" })
            }
          />
          <View style={styles.gap} />
          <Button
            title="I’m a business"
            variant="secondary"
            onPress={() =>
              navigation.navigate("BusinessAuth", { mode: "login" })
            }
          />
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Just looking? Try a sample.</Text>
            <View style={styles.demoLinks}>
              {(["personal", "business"] as const).map((lane) => (
                <MotionPressable
                  key={lane}
                  accessibilityRole="button"
                  onPress={() => enterDemoMode(lane)}
                  style={styles.demoLink}
                >
                  <Text style={styles.link}>
                    {lane === "personal" ? "Personal demo" : "Business demo"}
                  </Text>
                  <Icon name="arrow-up-right" size={15} color={colors.teal} />
                </MotionPressable>
              ))}
            </View>
          </View>
          <View style={styles.legal}>
            <Button
              title="Privacy policy"
              variant="ghost"
              onPress={() => navigation.navigate("Legal", { page: "privacy" })}
            />
            <Button
              title="Community guidelines & terms"
              variant="ghost"
              onPress={() => navigation.navigate("Legal", { page: "terms" })}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 20 },
  brand: { marginTop: 8 },
  heroCopy: { paddingTop: 66, paddingBottom: 22 },
  eyebrow: {
    ...typography.caption,
    color: colors.white,
    letterSpacing: 1.4,
    marginBottom: 14,
  },
  title: {
    ...typography.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.white,
    fontWeight: "800",
  },
  highlight: { color: colors.white },
  description: {
    ...typography.body,
    color: colors.onTeal,
    marginTop: 18,
    maxWidth: 350,
  },
  body: { paddingHorizontal: 22, paddingTop: 24 },
  sectionTitle: { ...typography.heading, color: colors.ink, marginBottom: 20 },
  gap: { height: 10 },
  preview: { marginTop: 24 },
  previewLabel: { ...typography.bodySmall, color: colors.textDim },
  demoLinks: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  demoLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 48,
  },
  link: { ...typography.label, color: colors.teal },
  legal: { marginTop: 16 },
});
