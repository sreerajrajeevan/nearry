import type { ViewStyle } from "react-native";
import { colors } from "./colors";

/** Shared Nearry surfaces for headings, forms, lists and selected controls. */
export const surfaces = {
  hero: {
    backgroundColor: colors.forest,
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  field: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 14,
  },
  selected: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldDeep,
  },
  notice: {
    backgroundColor: colors.sandSoft,
    borderRadius: 14,
    padding: 14,
  },
} satisfies Record<string, ViewStyle>;
