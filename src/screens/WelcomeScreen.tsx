import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, AccountType } from "../navigation/types";
import { useAuth } from "../store/AuthContext";
import { BrandMark, BrandWordmark } from "../components/BrandLogo";
import { EnterView, MotionPressable } from "../components/Motion";
import { Icon, IconName } from "../components/Icon";
import { WelcomeCollage } from "../components/onboarding/WelcomeCollage";
import { weight } from "../theme";

const NIGHT = "#030712";
const AMBER = "#F59E0B";
const AMBER_TEXT = "#FBBF24";
const MUTED = "#9CA3AF";
const GLASS = "rgba(255,255,255,0.08)";
const GLASS_LINE = "rgba(255,255,255,0.14)";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

export function WelcomeScreen({ navigation }: Props) {
  const { enterDemoMode } = useAuth();
  const { width, height } = useWindowDimensions();
  const [panel, setPanel] = useState<"none" | "login" | "demo">("none");
  // The headline's longest line should fit on one line on narrow phones.
  const titleSize = Math.min(36, Math.floor((width - 40) * 0.1));
  const heroHeight = Math.round(Math.min(Math.max(height * 0.52, 300), 470));
  const start = (accountType: AccountType) =>
    navigation.navigate("Introduction", { accountType });
  const toggle = (next: "login" | "demo") =>
    setPanel((p) => (p === next ? "none" : next));
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WelcomeCollage width={width} height={heroHeight + 40} />
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(3,7,18,0.8)",
          "rgba(3,7,18,0)",
          "rgba(3,7,18,0.55)",
          NIGHT,
        ]}
        locations={[0, 0.2, 0.52, 0.8]}
        style={[styles.fade, { height: heroHeight + 42 }]}
      />
      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={styles.safe}
      >
        <View style={styles.header}>
          <View
            style={styles.brand}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Nearry"
          >
            <BrandMark size={34} color={AMBER_TEXT} dotColor="#FFFFFF" />
            <BrandWordmark width={98} color="#FFFFFF" />
          </View>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Preview"
            accessibilityHint="Shows demo versions with sample data"
            accessibilityState={{ expanded: panel === "demo" }}
            onPress={() => toggle("demo")}
            style={styles.preview}
          >
            <Icon name="play-circle" size={15} color="#FFFFFF" />
            <Text style={styles.previewText}>Preview</Text>
          </MotionPressable>
        </View>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: Math.max(heroHeight - 125, 150) },
          ]}
        >
          <EnterView index={0}>
            <Text style={styles.kicker}>Good things happen nearby</Text>
            <Text
              accessibilityRole="header"
              style={[
                styles.title,
                {
                  fontSize: titleSize,
                  lineHeight: Math.round(titleSize * 1.12),
                },
              ]}
            >
              Your neighbourhood.{"\n"}Your kind of{" "}
              <Text style={styles.titleAccent}>people.</Text>
            </Text>
            <Text style={styles.sub}>
              Join plans, meet people and find local offers, all a short walk
              away.
            </Text>
          </EnterView>
          <EnterView index={1} style={styles.roles}>
            <RoleCard
              primary
              icon="users"
              title="Personal"
              line="Join plans and meet people"
              onPress={() => start("personal")}
            />
            <RoleCard
              icon="briefcase"
              title="Business"
              line="Bring people to your place"
              onPress={() => start("business")}
            />
          </EnterView>
          {panel === "demo" && (
            <EnterView style={styles.panel}>
              <Text style={styles.panelNote}>
                Sample data, no account needed.
              </Text>
              <View style={styles.panelRow}>
                <PanelButton
                  title="Personal demo"
                  onPress={() => enterDemoMode("personal")}
                />
                <PanelButton
                  title="Business demo"
                  onPress={() => enterDemoMode("business")}
                />
              </View>
            </EnterView>
          )}
          <EnterView index={2}>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Already have an account? Log in"
              accessibilityState={{ expanded: panel === "login" }}
              onPress={() => toggle("login")}
              style={styles.login}
            >
              <Text style={styles.loginText}>
                Already have an account?{" "}
                <Text style={styles.loginStrong}>Log in</Text>
              </Text>
            </MotionPressable>
            {panel === "login" && (
              <EnterView style={styles.panel}>
                <Text style={styles.panelNote}>Which account?</Text>
                <View style={styles.panelRow}>
                  <PanelButton
                    title="Personal"
                    icon="user"
                    onPress={() =>
                      navigation.navigate("PersonalAuth", { mode: "login" })
                    }
                  />
                  <PanelButton
                    title="Business"
                    icon="briefcase"
                    onPress={() =>
                      navigation.navigate("BusinessAuth", { mode: "login" })
                    }
                  />
                </View>
              </EnterView>
            )}
            <View style={styles.legal}>
              <View style={styles.legalRow}>
                <LegalLink
                  title="Terms & Community Guidelines"
                  onPress={() =>
                    navigation.navigate("Legal", { page: "terms" })
                  }
                />
                <LegalLink
                  title="Privacy Policy"
                  onPress={() =>
                    navigation.navigate("Legal", { page: "privacy" })
                  }
                />
                <LegalLink
                  title="Child safety standards"
                  onPress={() =>
                    navigation.navigate("Legal", { page: "child-safety" })
                  }
                />
              </View>
            </View>
          </EnterView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function RoleCard({
  icon,
  title,
  line,
  onPress,
  primary = false,
}: {
  icon: IconName;
  title: string;
  line: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}`}
      accessibilityHint={`Get started with a ${title.toLowerCase()} account`}
      onPress={onPress}
      style={[styles.role, primary ? styles.rolePrimary : styles.roleGlass]}
    >
      <View style={styles.roleTop}>
        <View
          style={[
            styles.roleIcon,
            primary ? styles.roleIconPrimary : styles.roleIconGlass,
          ]}
        >
          <Icon name={icon} size={20} color={primary ? NIGHT : AMBER_TEXT} />
        </View>
        <Icon
          name="arrow-up-right"
          size={20}
          color={primary ? NIGHT : "#FFFFFF"}
        />
      </View>
      <Text style={[styles.roleTitle, primary && styles.onAmber]}>{title}</Text>
      <Text style={[styles.roleLine, primary && styles.onAmberSoft]}>
        {line}
      </Text>
    </MotionPressable>
  );
}

function PanelButton({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon?: IconName;
  onPress: () => void;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.panelButton}
    >
      {icon && <Icon name={icon} size={16} color={AMBER_TEXT} />}
      <Text style={styles.panelButtonText}>{title}</Text>
    </MotionPressable>
  );
}

function LegalLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <MotionPressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={6}
      style={styles.legalLink}
    >
      <Text style={styles.legalLinkText}>{title}</Text>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT },
  fade: { position: "absolute", top: 0, left: 0, right: 0 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    zIndex: 1,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  preview: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(3,7,18,0.55)",
    borderWidth: 1,
    borderColor: GLASS_LINE,
  },
  previewText: { fontSize: 13, color: "#FFFFFF", ...weight("700") },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 18 },
  kicker: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: AMBER_TEXT,
    ...weight("800"),
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.3,
    color: "#FFFFFF",
    ...weight("800"),
  },
  titleAccent: { color: AMBER_TEXT },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    marginTop: 12,
    maxWidth: 340,
  },
  roles: { flexDirection: "row", gap: 12, marginTop: 24 },
  role: {
    flex: 1,
    minHeight: 132,
    borderRadius: 24,
    padding: 16,
    justifyContent: "space-between",
  },
  rolePrimary: { backgroundColor: AMBER },
  roleGlass: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_LINE,
  },
  roleTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  roleIconPrimary: { backgroundColor: "rgba(255,255,255,0.45)" },
  roleIconGlass: { backgroundColor: "rgba(251,191,36,0.14)" },
  roleTitle: {
    fontSize: 18,
    lineHeight: 23,
    color: "#FFFFFF",
    ...weight("800"),
  },
  roleLine: { fontSize: 13, lineHeight: 18, color: MUTED, marginTop: 2 },
  onAmber: { color: NIGHT },
  onAmberSoft: { color: "rgba(3,7,18,0.72)" },
  login: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  loginText: { fontSize: 14, color: MUTED },
  loginStrong: { color: "#FFFFFF", ...weight("800") },
  panel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_LINE,
    gap: 10,
  },
  panelNote: {
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
    textAlign: "center",
  },
  panelRow: { flexDirection: "row", gap: 10 },
  panelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  panelButtonText: { fontSize: 14, color: "#FFFFFF", ...weight("700") },
  legal: { marginTop: 10, alignItems: "center" },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 12,
  },
  legalLink: { minHeight: 32, justifyContent: "center" },
  legalLinkText: {
    fontSize: 11,
    lineHeight: 16,
    color: MUTED,
    textDecorationLine: "underline",
  },
});
