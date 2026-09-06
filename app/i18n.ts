import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import nlTranslation from "./locales/nl.json";
import enTranslation from "./locales/en.json";

export function initI18n(lang?: string) {
  if (i18n.isInitialized) {
    if (lang) i18n.changeLanguage(lang);
    return i18n;
  }

  let instance = i18n.use(initReactI18next);
  if (!lang) {
    instance = instance.use(LanguageDetector);
  }

  instance.init({
    ...(lang ? { lng: lang } : {}),
    fallbackLng: "nl",
    supportedLngs: ["nl", "en"],
    resources: {
      nl: nlTranslation,
      en: enTranslation,
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initImmediate: false,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

  return i18n;
}
