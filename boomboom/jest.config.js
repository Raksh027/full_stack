module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest/setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community|-vector-icons)?|@react-navigation|@reduxjs|immer|react-redux|react-native-.*|@invertase|@react-native-google-signin)/)',
  ],
};
