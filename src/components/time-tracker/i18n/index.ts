"use client";
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import nl from './locales/nl.json';
import fr from './locales/fr.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';

const resources = {
  en: { translation: en },
  nl: { translation: nl },
  fr: { translation: fr },
  ro: { translation: ro },
  ru: { translation: ru },
};

if (!i18n.isInitialized) {
  const i18nInstance = i18n.use(initReactI18next);

  if (typeof window !== 'undefined') {
    i18nInstance.use(LanguageDetector);
  }

  i18nInstance.init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: typeof window !== 'undefined' ? {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    } : undefined,
  });
}

export default i18n;

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
];
