module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Vision Camera v4 frame processors compile through worklets-core...
      'react-native-worklets-core/plugin',
      // ...and Reanimated 4 (Expo SDK 56 default) compiles through worklets.
      // The worklets/reanimated plugin must be listed LAST.
      'react-native-worklets/plugin',
    ],
  };
};
