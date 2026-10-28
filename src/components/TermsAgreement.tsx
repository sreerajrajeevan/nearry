import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MotionPressable } from "./Motion";
import { Icon } from "./Icon";
import { colors, typography } from "../theme";

/** Small signup control. Policy links are separate tap targets and never toggle acceptance. */
export function TermsAgreement({
  checked,
  onChange,
  onTerms,
  onPrivacy,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onTerms: () => void;
  onPrivacy: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <MotionPressable
        accessibilityRole="checkbox"
        aria-checked={checked}
        accessibilityLabel="I’m 18 or older and agree to the Terms and Community Guidelines"
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        style={styles.control}
      >
        <View style={[styles.box, checked && styles.checked]}>
          {checked && <Icon name="check" size={16} color={colors.onAccent} />}
        </View>
        <Text style={styles.copy}>
          I’m 18 or older and agree to the Terms & Community Guidelines.
        </Text>
      </MotionPressable>
      <View style={styles.links}>
        <MotionPressable
          accessibilityRole="link"
          accessibilityLabel="Read Terms and Community Guidelines"
          onPress={onTerms}
          disabled={disabled}
          style={styles.link}
        >
          <Text style={styles.linkText}>Terms & Community Guidelines</Text>
        </MotionPressable>
        <MotionPressable
          accessibilityRole="link"
          accessibilityLabel="Read Privacy Policy"
          onPress={onPrivacy}
          disabled={disabled}
          style={styles.link}
        >
          <Text style={styles.linkText}>Privacy Policy</Text>
        </MotionPressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { marginTop: 12, marginBottom: 8 },
  control: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    minHeight: 48,
    paddingVertical: 10,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { borderColor: colors.accent, backgroundColor: colors.accent },
  copy: { ...typography.bodySmall, color: colors.text, flex: 1 },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    marginLeft: 32,
  },
  link: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  linkText: {
    ...typography.caption,
    color: colors.clayDeep,
    textDecorationLine: "underline",
  },
});
