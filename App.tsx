import { navigationRef } from "./src/navigation/navigationRef";
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useAssets } from "expo-asset";
import * as SplashScreen from "expo-splash-screen";
import Feather from "@expo/vector-icons/Feather";
import { AuthProvider, useAuth } from "./src/store/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { BRAND_ASSETS } from "./src/components/BrandLogo";
import { StartupSplash } from "./src/components/StartupSplash";
import { colors } from "./src/theme";
import { MotionProvider } from "./src/store/MotionContext";

// Hold the native brand artwork until React has laid out its matching launch frame.
void SplashScreen.preventAutoHideAsync().catch(() => {});
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

function AppShell({ resourcesReady }: { resourcesReady: boolean }) {
  const { bootstrapping, profileLoading, demoMode, refreshProfile } = useAuth();
  const [laidOut, setLaidOut] = useState(false);
  const [nativeHidden, setNativeHidden] = useState(false);
  const [launchVisible, setLaunchVisible] = useState(true);
  useEffect(() => {
    if (!laidOut || !resourcesReady) return;
    let active = true;
    void SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => {
        if (active) setNativeHidden(true);
      });
    return () => {
      active = false;
    };
  }, [laidOut, resourcesReady]);
  const ready =
    resourcesReady && !bootstrapping && (demoMode || !profileLoading);
  return (
    <View style={styles.canvas} onLayout={() => setLaidOut(true)}>
      <View style={styles.app}>
        {resourcesReady && (
          <View
            style={styles.content}
            accessibilityElementsHidden={launchVisible}
            importantForAccessibility={
              launchVisible ? "no-hide-descendants" : "auto"
            }
            pointerEvents={launchVisible ? "none" : "auto"}
          >
            <NavigationContainer theme={navTheme} ref={navigationRef}>
              <RootNavigator />
            </NavigationContainer>
          </View>
        )}
        {launchVisible && (
          <StartupSplash
            active={nativeHidden}
            ready={ready}
            onFinish={() => setLaunchVisible(false)}
            onRetry={() => void refreshProfile().catch(() => {})}
          />
        )}
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(Feather.font);
  const [assets, assetError] = useAssets(BRAND_ASSETS);
  return (
    <SafeAreaProvider>
      <MotionProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <AppShell
            resourcesReady={
              !!(fontsLoaded || fontError) && !!(assets || assetError)
            }
          />
        </AuthProvider>
      </MotionProvider>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  content: { flex: 1 },
  canvas: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, width: "100%", maxWidth: 720, alignSelf: "center" },
});
