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
import { Icon, IconName } from "../components/Icon";
import { colors, typography, spacing, radius, surfaces } from "../theme";
import { RootStackParamList } from "../navigation/types";
import { useAuth } from "../store/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

/** One role, one door: the title names who it is for, the subtitle what happens next. */
function RoleCard({
  title,
  subtitle,
  icon,
  variant,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  variant: "primary" | "secondary";
  onPress: () => void;
}) {
  const primary = variant === "primary";
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.roleCard,
        primary ? styles.roleCardPrimary : styles.roleCardSecondary,
      ]}
    >
      <Icon
        name={icon}
        size={22}
        color={primary ? colors.onSage : colors.accent}
      />
      <View style={styles.roleText}>
        <Text
          style={[
            styles.roleTitle,
            primary ? styles.roleTitlePrimary : styles.roleTitleSecondary,
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.roleSubtitle,
            primary
              ? styles.roleSubtitlePrimary
              : styles.roleSubtitleSecondary,
          ]}
        >
          {subtitle}
        </Text>
      </View>
      <Icon
        name="chevron-right"
        size={20}
        color={primary ? colors.onSage : colors.textDim}
      />
    </TouchableOpacity>
  );
}

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
          <RoleCard
            title="Join as a person"
            subtitle="Find games, people & plans near you — free"
            icon="users"
            variant="primary"
            onPress={() =>
              navigation.navigate("PersonalAuth", { mode: "signup" })
            }
          />
          <RoleCard
            title="I’m a business"
            subtitle="List your place, post offers, take bookings"
            icon="briefcase"
            variant="secondary"
            onPress={() =>
              navigation.navigate("BusinessAuth", { mode: "login" })
            }
          />
        </View>
        <View style={styles.preview}>
          <Text style={styles.note}>
            Just looking? Try a demo — no account needed.
          </Text>
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
        </View>
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
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: spacing.lg },
  hero: {
    ...surfaces.hero,
    marginTop: 16,
    justifyContent: "center",
    paddingVertical: 28,
  },
  greeting: {
    ...typography.bodySmall,
    color: colors.sageSoft,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1.2,
    color: colors.onAccent,
  },
  accent: { color: colors.gold },
  description: {
    ...typography.body,
    color: colors.goldSoft,
    marginTop: spacing.lg,
    maxWidth: 350,
  },
  actions: { gap: 12 },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  roleCardPrimary: {
    backgroundColor: colors.sage,
    borderColor: colors.sage,
  },
  roleCardSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  roleText: { flex: 1 },
  roleTitle: { ...typography.body, fontWeight: "600" },
  roleTitlePrimary: { color: colors.onSage },
  roleTitleSecondary: { color: colors.text },
  roleSubtitle: { ...typography.bodySmall, marginTop: 2 },
  roleSubtitlePrimary: { color: colors.onSage, opacity: 0.85 },
  roleSubtitleSecondary: { color: colors.textDim },
  preview: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: "center",
  },
  demoLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.lg,
    marginTop: spacing.sm,
  },
  demoLink: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    minHeight: 48,
  },
  link: { ...typography.bodySmall, color: colors.accent },
  note: { ...typography.caption, color: colors.textDim, textAlign: "center" },
});
