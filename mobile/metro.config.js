// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle TensorFlow Lite models as assets so they can be require()'d and loaded
// on-device by react-native-fast-tflite.
config.resolver.assetExts.push('tflite');

module.exports = config;
