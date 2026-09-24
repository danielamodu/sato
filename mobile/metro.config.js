// Metro config. Stacks.js reaches for a couple of Node core modules that don't
// exist in React Native; point Metro at RN-safe shims (per the official
// Stacks.js React Native integration guide).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve("readable-stream"),
  crypto: require.resolve("crypto-browserify"),
};

module.exports = config;
