"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "my";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Pick the string for the current language. */
  t: (en: string, my: string) => string;
};

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = (en: string, my: string) => (lang === "my" ? my : en);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): Ctx {
  const c = useContext(LangContext);
  if (!c) throw new Error("useLang must be used within LanguageProvider");
  return c;
}
