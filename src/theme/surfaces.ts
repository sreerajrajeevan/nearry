import type { ViewStyle } from "react-native";
import { colors } from "./colors";
import { radius, shadows } from "./spacing";

/** Shared modern surfaces for headings, forms, lists and selected controls. */
export const surfaces = {
  hero: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: 24,
    marginTop: 8,
    marginBottom: 24,
    ...shadows.accent,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  field: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  selected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  notice: {
    backgroundColor: colors.sandSoft,
    borderRadius: radius.md,
    padding: 14,
  },
} satisfies Record<string, ViewStyle>;
