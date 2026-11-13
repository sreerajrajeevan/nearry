import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "../Icon";
import { MotionPressable, ScreenReveal } from "../Motion";

export const onboardingColors = {
  paper: "#FAFAF7",
  white: "#FFFFFF",
  ink: "#20252D",
  muted: "#656C67",
  line: "#E7E8E2",
  soft: "#F0F1EC",
  orange: "#CC4522",
  bright: "#F15A32",
  peach: "#FFF0E7",
  green: "#00775C",
  mint: "#E3F5E9",
};
const c = onboardingColors;
export const ob = StyleSheet.create({
  title: {
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.9,
    fontWeight: "700",
    color: c.ink,
  },
  kicker: {
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontWeight: "700",
    color: c.orange,
    marginBottom: 9,
  },
  sub: {
    fontSize: 14,
    lineHeight: 21,
    color: c.muted,
    marginTop: 12,
    marginBottom: 24,
  },
  help: { fontSize: 12, lineHeight: 18, color: c.muted, marginTop: 8 },
  label: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: c.ink,
    marginBottom: 9,
    marginTop: 22,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  tile: {
    width: "31%",
    flexGrow: 1,
    minWidth: 80,
    minHeight: 100,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  selected: { backgroundColor: c.peach, borderColor: c.orange },
  tileText: {
    fontSize: 12,
    lineHeight: 18,
    color: c.ink,
    fontWeight: "600",
    textAlign: "center",
  },
  emoji: { fontSize: 30, lineHeight: 38 },
  segment: {
    flex: 1,
    minWidth: 76,
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 12,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 9,
  },
  segmentText: { fontSize: 13, fontWeight: "600", color: c.ink },
  card: {
    backgroundColor: c.white,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  error: { color: "#B13A21", fontSize: 13, lineHeight: 19, marginVertical: 12 },
  full: { flex: 1 },
});

export function OnboardingLayout({
  children,
  footer,
  onBack,
  step,
  total,
  brand = false,
  headerAction,
  screenKey,
  busy = false,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  onBack?: () => void;
  step?: number;
  total?: number;
  brand?: boolean;
  headerAction?: React.ReactNode;
  screenKey?: string | number;
  busy?: boolean;
}) {
  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={styles.safe}
    >
      <KeyboardAvoidingView
        style={ob.full}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.nav}>
          {onBack && (
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              disabled={busy}
              onPress={onBack}
              style={styles.back}
            >
              <Icon name="chevron-left" size={23} color={c.ink} />
            </MotionPressable>
          )}
          {brand && (
            <View style={styles.brand}>
              <View style={styles.mark}>
                <Icon name="map-pin" size={22} color={c.white} />
              </View>
              <Text style={styles.wordmark}>nearry</Text>
            </View>
          )}
          {total != null && (
            <View
              style={styles.progress}
              accessibilityRole="progressbar"
              accessibilityLabel={`Setup step ${step} of ${total}`}
              accessibilityValue={{ min: 0, max: total, now: step ?? 0 }}
            >
              {Array.from({ length: total }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressPart,
                    i < (step ?? 0) && styles.progressFilled,
                  ]}
                />
              ))}
            </View>
          )}
          {headerAction && (
            <View style={styles.headerAction}>{headerAction}</View>
          )}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <ScreenReveal key={screenKey} style={ob.full}>
            {children}
          </ScreenReveal>
          <View style={styles.footer}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function OnboardingHeading({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View>
      <Text style={ob.kicker}>{kicker}</Text>
      <Text accessibilityRole="header" style={ob.title}>
        {title}
      </Text>
      {subtitle && <Text style={ob.sub}>{subtitle}</Text>}
    </View>
  );
}
export function OnboardingButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        inactive && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? c.ink : c.white} />
      ) : (
        <>
          <Text
            style={[
              styles.buttonText,
              secondary && { color: c.ink },
              inactive && { color: c.muted },
            ]}
          >
            {title}
          </Text>
          <Icon
            name="arrow-right"
            size={18}
            color={inactive ? c.muted : secondary ? c.ink : c.white}
          />
        </>
      )}
    </MotionPressable>
  );
}
export function OnboardingLink({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <MotionPressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={styles.link}
    >
      <Text style={[styles.linkText, disabled && { color: c.muted }]}>
        {title}
      </Text>
    </MotionPressable>
  );
}
export function OnboardingInput({
  label,
  clearable = false,
  ...props
}: TextInputProps & { label: string; clearable?: boolean }) {
  return (
    <View>
      <Text style={ob.label}>{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          selectionColor={c.orange}
          {...props}
          style={[styles.input, clearable && { paddingRight: 48 }, props.style]}
        />
        {clearable && !!props.value && props.editable !== false && (
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            onPress={() => props.onChangeText?.("")}
            style={styles.clear}
          >
            <Icon name="x" size={18} color={c.muted} />
          </MotionPressable>
        )}
      </View>
    </View>
  );
}
export function OnboardingHero({
  kind,
  compact = false,
}: {
  kind: "play" | "join" | "offers" | "welcome" | "business";
  compact?: boolean;
}) {
  const green = kind === "join",
    blue = kind === "offers";
  const emoji =
    kind === "business"
      ? "🏪"
      : kind === "join"
        ? "🤝"
        : kind === "offers"
          ? "🎁"
          : "🏸";
  return (
    <LinearGradient
      colors={
        green
          ? ["#08C78C", "#008B69"]
          : blue
            ? ["#428DFF", "#6049E8"]
            : ["#FF663A", "#FFAC25"]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, compact && styles.compact]}
      accessible
      accessibilityLabel={
        compact
          ? "Meet, play and discover nearby"
          : `${kind} introduction illustration`
      }
    >
      <View
        style={[
          styles.orbit,
          { width: compact ? 185 : 280, height: compact ? 185 : 280 },
        ]}
      />
      <View
        style={[
          styles.orbit,
          { width: compact ? 270 : 420, height: compact ? 270 : 420 },
        ]}
      />
      {compact ? (
        <View style={styles.emojiRow}>
          {["☕", "🏸", "🌿"].map((e, i) => (
            <Text
              key={e}
              style={[
                styles.compactEmoji,
                { transform: [{ rotate: `${i === 1 ? 9 : -10}deg` }] },
              ]}
            >
              {e}
            </Text>
          ))}
        </View>
      ) : (
        <>
          <View style={[styles.float, styles.floatTop]}>
            <Text style={styles.floatText}>
              {green
                ? "✅ Request accepted"
                : blue
                  ? "🏷️ Local favourites"
                  : kind === "business"
                    ? "📍 Get discovered"
                    : "⚽ Need 2 more players"}
            </Text>
          </View>
          <Text style={styles.heroEmoji}>{emoji}</Text>
          <View style={[styles.float, styles.floatBottom]}>
            <Text style={styles.floatText}>
              {green
                ? "☕ Coffee after work?"
                : blue
                  ? "✨ A little something nearby"
                  : kind === "business"
                    ? "☕ Made for local places"
                    : "📍 1.2 km away"}
            </Text>
          </View>
        </>
      )}
    </LinearGradient>
  );
}
export function OnboardingRoleChoice({
  role,
  onChange,
  disabled = false,
}: {
  role: "personal" | "business" | null;
  onChange: (role: "personal" | "business") => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{ gap: 12 }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Account type"
    >
      {(
        [
          {
            value: "personal",
            emoji: "🙌",
            title: "Personal",
            sub: "Find plans, meet people and discover local offers.",
          },
          {
            value: "business",
            emoji: "🏪",
            title: "Business",
            sub: "Bring people to your place with offers and experiences.",
          },
        ] as const
      ).map((item) => (
        <MotionPressable
          key={item.value}
          accessibilityRole="radio"
          aria-checked={role === item.value}
          accessibilityLabel={item.title}
          accessibilityState={{ checked: role === item.value, disabled }}
          disabled={disabled}
          onPress={() => onChange(item.value)}
          style={[styles.role, role === item.value && ob.selected]}
        >
          <Text style={ob.emoji}>{item.emoji}</Text>
          <View style={ob.full}>
            <Text style={styles.roleTitle}>{item.title}</Text>
            <Text style={styles.roleSub}>{item.sub}</Text>
          </View>
          <View
            style={[styles.radio, role === item.value && styles.radioSelected]}
          />
        </MotionPressable>
      ))}
    </View>
  );
}
export function OnboardingRules() {
  return (
    <View style={styles.rules}>
      {[
        ["🤝", "Be kind.", "Make room for a new hello."],
        ["🗓️", "Plans change.", "Let the host know early."],
        ["🚩", "Something feels off?", "Report or block anytime."],
      ].map(([emoji, title, copy]) => (
        <View key={title} style={[ob.row, { alignItems: "flex-start" }]}>
          <Text>{emoji}</Text>
          <Text style={styles.ruleText}>
            <Text style={{ fontWeight: "700" }}>{title} </Text>
            {copy}
          </Text>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.paper },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 8,
    minHeight: 60,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 18,
  },
  footer: { paddingTop: 28, marginTop: "auto", gap: 6 },
  brand: { flexDirection: "row", alignItems: "center", gap: 7 },
  mark: {
    width: 30,
    height: 34,
    borderRadius: 11,
    backgroundColor: c.bright,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -1.1,
    color: c.ink,
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: c.white,
  },
  headerAction: { marginLeft: "auto" },
  progress: { flexDirection: "row", gap: 4, flex: 1 },
  progressPart: {
    height: 5,
    borderRadius: 10,
    flex: 1,
    backgroundColor: c.line,
  },
  progressFilled: { backgroundColor: c.bright },
  button: {
    backgroundColor: c.orange,
    minHeight: 54,
    padding: 15,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: c.white,
    flexShrink: 1,
    textAlign: "center",
  },
  secondary: { backgroundColor: c.white, borderWidth: 1, borderColor: c.line },
  disabled: { backgroundColor: "#E2E4DE", borderColor: "#E2E4DE" },
  link: {
    minHeight: 44,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: {
    fontSize: 12,
    lineHeight: 19,
    color: c.orange,
    fontWeight: "600",
    textAlign: "center",
  },
  input: {
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 14,
    minHeight: 54,
    paddingHorizontal: 15,
    paddingVertical: 13,
    color: c.ink,
    fontSize: 16,
    lineHeight: 23,
  },
  clear: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    height: 340,
    borderRadius: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 27,
  },
  compact: { height: 144, borderRadius: 25, marginBottom: 25 },
  orbit: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.35)",
    borderRadius: 999,
  },
  heroEmoji: {
    fontSize: 116,
    lineHeight: 150,
    transform: [{ rotate: "-10deg" }],
  },
  float: {
    position: "absolute",
    backgroundColor: c.white,
    borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "85%",
  },
  floatTop: { top: 38, left: 18, transform: [{ rotate: "-5deg" }] },
  floatBottom: { bottom: 35, right: 16, transform: [{ rotate: "4deg" }] },
  floatText: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: c.ink },
  emojiRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  compactEmoji: { fontSize: 58, lineHeight: 80 },
  role: {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 20,
    backgroundColor: c.white,
    padding: 17,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
  },
  roleTitle: { fontSize: 17, lineHeight: 24, fontWeight: "700", color: c.ink },
  roleSub: { fontSize: 12, lineHeight: 18, color: c.muted, marginTop: 4 },
  radio: {
    borderWidth: 1,
    borderColor: "#B7BDB6",
    borderRadius: 10,
    width: 20,
    height: 20,
    marginTop: 3,
  },
  radioSelected: {
    borderWidth: 5,
    borderColor: c.orange,
    backgroundColor: c.white,
  },
  rules: { padding: 16, borderRadius: 18, backgroundColor: c.mint, gap: 13 },
  ruleText: { flex: 1, color: c.ink, fontSize: 12, lineHeight: 18 },
});
