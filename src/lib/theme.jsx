import { createContext, useContext, useCallback, useEffect, useState } from "react";

/**
 * Provider tema ringan (pengganti next-themes) — cocok untuk SPA yang dirender
 * sepenuhnya di klien, jadi tidak menyisipkan <script> saat render (yang memicu
 * warning "Encountered a script tag while rendering React component").
 *
 * Nilai theme: "light" | "dark" | "system". Atribut yang dipasang di <html>
 * adalah data-theme="dark" atau data-theme="light". Anti-kedip ditangani oleh
 * skrip kecil di src/app/layout.tsx yang jalan sebelum paint.
 */

const STORAGE_KEY = "theme";
const ThemeCtx = createContext(null);

function systemPrefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function applyTheme(theme) {
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  const el = document.documentElement;
  el.setAttribute("data-theme", dark ? "dark" : "light");
  el.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") return saved;
    } catch {}
    return "system";
  });

  const setTheme = useCallback((next) => {
    if (next !== "light" && next !== "dark" && next !== "system") return;
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    applyTheme(next);
  }, []);

  // Terapkan tiap kali nilai berubah.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Ikuti perubahan preferensi OS ketika mode "system".
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) || "system";
        if (saved === "system") applyTheme("system");
      } catch {}
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx) || { theme: "system", setTheme: () => {} };
}
