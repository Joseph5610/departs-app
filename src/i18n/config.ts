
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import cs from './locales/cs.json';
import sk from './locales/sk.json';
import { getViewerCountry } from '../utils/viewerCountry';

export const SUPPORTED_LANGUAGES = ['en', 'cs', 'sk'] as const;

/** Countries whose viewers default to a local language regardless of the browser language. */
const LANGUAGE_BY_VIEWER_COUNTRY: Record<string, string> = {
  SK: 'sk',
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector({
  name: 'viewerCountry',
  lookup: () => {
    const country = getViewerCountry();
    return country ? LANGUAGE_BY_VIEWER_COUNTRY[country] : undefined;
  },
});

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      cs: { translation: cs },
      sk: { translation: sk },
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'querystring', 'viewerCountry', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export default i18n;
