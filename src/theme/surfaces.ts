import type { ViewStyle } from "react-native";
import { colors } from "./colors";

/** Shared coastal surfaces used across both account experiences. */
export const surfaces = {
  hero: {
    backgroundColor: colors.forest,
    borderRadius: 28,
    padding: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
  },
  field: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
  },
  selected: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  notice: {
    backgroundColor: colors.sandSoft,
    borderRadius: 18,
    padding: 14,
  },
} satisfies Record<string, ViewStyle>;
