import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";
import { Icon, IconName } from "./Icon";
import { MotionPressable } from "./Motion";

export function SectionHeading({
  title,
  subtitle,
  icon,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.top}>
        {icon && (
          <View style={styles.icon}>
            <Icon name={icon} size={21} color={colors.action} />
          </View>
        )}
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
        {action && onAction && (
          <MotionPressable
            style={styles.link}
            accessibilityRole="button"
            accessibilityLabel={action}
            onPress={onAction}
          >
            <Text style={styles.linkText}>{action}</Text>
            <Icon name="arrow-right" size={16} color={colors.teal} />
          </MotionPressable>
        )}
      </View>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 9, flexWrap: "wrap" },
  copy: { flex: 1, minWidth: 100 },
  title: {
    ...typography.title,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "800",
    color: colors.ink,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.claySoft,
  },
  subtitle: { ...typography.bodySmall, color: colors.textDim, marginTop: 3 },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 },
  linkText: { ...typography.label, color: colors.teal },
});
