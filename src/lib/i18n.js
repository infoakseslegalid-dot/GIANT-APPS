import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import id from "../locales/id.json";
import en from "../locales/en.json";

// Bahasa awal: dari localStorage (diisi setelah user login), fallback "id".
let initial = "id";
try {
  const saved = localStorage.getItem("locale");
  if (saved === "id" || saved === "en") initial = saved;
} catch {}

i18n.use(initReactI18next).init({
  resources: { id: { translation: id }, en: { translation: en } },
  lng: initial,
  fallbackLng: "id",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLocale(loc) {
  if (loc !== "id" && loc !== "en") return;
  try { localStorage.setItem("locale", loc); } catch {}
  if (i18n.language !== loc) i18n.changeLanguage(loc);
}

export default i18n;
