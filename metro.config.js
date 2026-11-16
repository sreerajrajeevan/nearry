// Sentry's Expo config adds debug IDs so crash reports can map to source.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
