import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { monitoringEnabled, reportError } from "../services/monitoring";

/**
 * Last line of defence: a crash in any screen shows this instead of closing
 * the app, and is reported. Uses system fonts and no providers, so it still
 * renders when those are what failed.
 */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    reportError(error, "screen");
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.page}>
        <View style={styles.mark}>
          <Text style={styles.markText}>!</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Something went wrong
        </Text>
        <Text style={styles.body}>
          {monitoringEnabled
            ? "Sorry about that. We’ve been told about it automatically."
            : "Sorry about that."}{" "}
          Try again, and if it keeps happening, restart the app.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => this.setState({ failed: false })}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#F8FAFC",
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBBF24",
    marginBottom: 20,
  },
  markText: { fontSize: 32, fontWeight: "800", color: "#030712" },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4B5563",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    maxWidth: 320,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#030712",
  },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
