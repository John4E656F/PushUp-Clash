module.exports = {
  preset: 'jest-expo',
  // The rep counter is pure TS; restrict tests to it so the suite runs without
  // native modules. Broaden this as more testable units land.
  testMatch: ['**/src/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@clerk/.*))',
  ],
};
