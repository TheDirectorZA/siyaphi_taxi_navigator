import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zu from './locales/zu.json';
import af from './locales/af.json';
import xh from './locales/xh.json';

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    en: { translation: en },
    zu: { translation: zu },
    af: { translation: af },
    xh: { translation: xh },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'xh', label: 'isiXhosa' },
];
