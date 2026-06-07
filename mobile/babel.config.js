module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated + worklets must be last.
      'react-native-worklets-core/plugin',
      'react-native-reanimated/plugin',
    ],
  };
};
