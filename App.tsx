import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import Feather from "@expo/vector-icons/Feather";
import { AuthProvider } from "./src/store/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { colors } from "./src/theme";
import { MotionProvider } from "./src/store/MotionContext";

const navTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
    notification: colors.accent,
  },
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts(Feather.font);
  return (
    <SafeAreaProvider>
      <MotionProvider>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <View style={styles.canvas}>
          <View style={styles.app}>
            {!fontsLoaded && !fontError ? (
              <ActivityIndicator style={styles.loading} color={colors.accent} />
            ) : (
              <AuthProvider>
                <NavigationContainer theme={navTheme}>
                  <RootNavigator />
                </NavigationContainer>
              </AuthProvider>
            )}
          </View>
        </View>
      </MotionProvider>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, width: "100%", maxWidth: 720, alignSelf: "center" },
  loading: { flex: 1 },
});
