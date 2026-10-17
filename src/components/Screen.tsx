import React, { useContext } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { colors, spacing } from "../theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  scroll?: boolean;
  keyboard?: boolean;
};

/** Safe areas belong to the screen at the top and the tab bar at the bottom. */
export function Screen({
  children,
  style,
  padded = true,
  scroll = false,
  keyboard = false,
}: Props) {
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  return (
    <SafeAreaView
      style={styles.safe}
      edges={
        tabBarHeight == null
          ? ["top", "bottom", "left", "right"]
          : ["top", "left", "right"]
      }
    >
      <KeyboardAvoidingView
        style={styles.flex}
        enabled={keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scroll,
              padded && styles.padded,
              style,
            ]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, padded && styles.padded, style]}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingBottom: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
});
