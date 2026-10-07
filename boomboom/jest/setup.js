/* eslint-env jest */

require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('./mocks/reanimated'));

jest.mock('react-native-config', () => ({
  APP_ENV: 'development',
  API_URL: 'http://localhost:8000',
  WS_URL: 'ws://localhost:8000/ws',
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  },
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('react-native-mmkv', () => {
  const createMMKV = () => {
    const data = new Map();
    return {
      getString: key => data.get(key),
      set: (key, value) => data.set(key, value),
      remove: key => data.delete(key),
      clearAll: () => data.clear(),
    };
  };
  return { createMMKV };
});

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

jest.mock('react-native-localize', () => ({
  getLocales: () => [
    {
      languageCode: 'en',
      countryCode: 'US',
      languageTag: 'en-US',
      isRTL: false,
    },
  ],
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(),
    signOut: jest.fn(() => Promise.resolve()),
  },
  isErrorWithCode: () => false,
  isSuccessResponse: response => response?.type === 'success',
  statusCodes: {},
}));

jest.mock('react-native-video', () => 'Video');

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(() => Promise.resolve({ didCancel: true })),
  launchImageLibrary: jest.fn(() => Promise.resolve({ didCancel: true })),
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const Mock = View;
  return {
    __esModule: true,
    default: Mock,
    Marker: View,
    Circle: View,
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  requestAuthorization: jest.fn(success => success()),
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native-razorpay', () => ({
  __esModule: true,
  default: { open: jest.fn(() => Promise.resolve({})) },
}));

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    isSupported: false,
    performRequest: jest.fn(),
    getCredentialStateForUser: jest.fn(),
    Operation: {},
    Scope: {},
    State: {},
    Error: {},
  },
}));
