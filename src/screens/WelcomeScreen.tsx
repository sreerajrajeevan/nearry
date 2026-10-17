import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { BrandHeader } from "../components/BrandHeader";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { colors, typography, spacing } from "../theme";
import { RootStackParamList } from "../navigation/types";
import { useAuth } from "../store/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;
export function WelcomeScreen({ navigation }: Props) {
  const { enterDemoMode } = useAuth();
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader />
        <View style={styles.hero}>
          <Text style={styles.greeting}>
            Good company is closer than you think.
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            A good plan{"\n"}starts with{"\n"}
            <Text style={styles.accent}>hello.</Text>
          </Text>
          <Text style={styles.description}>
            Find a game, meet someone new, or make a little time for yourself.
            Right in your neighbourhood.
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            title="Find my next plan"
            onPress={() =>
              navigation.navigate("PersonalAuth", { mode: "login" })
            }
          />
          <Button
            title="I’m a business"
            variant="secondary"
            onPress={() =>
              navigation.navigate("BusinessAuth", { mode: "login" })
            }
          />
        </View>
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Take a look around</Text>
          <View style={styles.demoLinks}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => enterDemoMode("personal")}
              style={styles.demoLink}
            >
              <Text style={styles.link}>Personal demo</Text>
              <Icon name="arrow-up-right" size={15} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => enterDemoMode("business")}
              style={styles.demoLink}
            >
              <Text style={styles.link}>Business demo</Text>
              <Icon name="arrow-up-right" size={15} color={colors.accent} />
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>
            Demos use sample data. No account needed.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: spacing.lg },
  hero: { flex: 1, justifyContent: "center", paddingVertical: spacing.xxl },
  greeting: {
    ...typography.bodySmall,
    color: colors.textDim,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: -2,
    color: colors.text,
  },
  accent: { color: colors.accent },
  description: {
    ...typography.body,
    color: colors.textDim,
    marginTop: spacing.lg,
    maxWidth: 350,
  },
  actions: { gap: 12 },
  preview: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  previewLabel: { ...typography.bodySmall, color: colors.text },
  demoLinks: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg },
  demoLink: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    minHeight: 48,
  },
  link: { ...typography.bodySmall, color: colors.accent },
  note: { ...typography.caption, color: colors.textDim },
});
