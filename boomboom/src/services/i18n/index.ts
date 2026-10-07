import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'react-native-localize';

import en from './locales/en.json';

export const defaultNS = 'translation';

export const resources = {
  en: { translation: en },
} as const;

export type SupportedLanguage = keyof typeof resources;

const supportedLanguages = Object.keys(resources) as SupportedLanguage[];

function isSupported(
  language: string | undefined,
): language is SupportedLanguage {
  return supportedLanguages.includes(language as SupportedLanguage);
}

function resolveLanguage(preferred: string | null): SupportedLanguage {
  if (preferred && isSupported(preferred)) {
    return preferred;
  }
  const deviceLanguage = getLocales()[0]?.languageCode;
  return isSupported(deviceLanguage) ? deviceLanguage : 'en';
}

export function initI18n(preferredLanguage: string | null) {
  return i18n.use(initReactI18next).init({
    resources,
    defaultNS,
    lng: resolveLanguage(preferredLanguage),
    fallbackLng: 'en',
    initAsync: false,
    interpolation: { escapeValue: false },
  });
}

export function applyLanguagePreference(language: string | null) {
  const next = resolveLanguage(language);
  if (i18n.language !== next) {
    i18n.changeLanguage(next);
  }
}

export { i18n };
