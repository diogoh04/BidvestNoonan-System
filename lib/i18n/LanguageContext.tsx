"use client";

// Tradução leve, só de interface (não mexe na folha de ponto em si — Sign
// In/Sign Out Book continua em inglês de propósito, é o documento oficial).
// Chave = a própria string em inglês (mais rápido de aplicar em cima do
// código existente do que inventar chaves abstratas); o dicionário PT mora
// em ./dictionary.ts. Sem provider por perto (ex.: dentro de telas do
// Master), `useLanguage()` cai no valor default abaixo — `t` vira
// identidade, então chamar `t(...)` em qualquer lugar nunca quebra nem muda
// nada fora do idioma escolhido.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { pt } from "./dictionary";

export type Lang = "en" | "pt";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (s: string) => string;
};

const STORAGE_KEY = "bn-lang";

const defaultValue: LanguageContextValue = {
  lang: "en",
  setLang: () => {},
  t: (s) => s,
};

const LanguageContext = createContext<LanguageContextValue>(defaultValue);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Sempre começa "en" (bate com o HTML renderizado no servidor) — o
  // useEffect abaixo lê o localStorage só depois de montar, então não dá
  // erro de hydration mismatch. Troca visível é rápida o bastante (é local).
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "pt" || saved === "en") setLangState(saved);
  }, []);

  function setLang(next: Lang) {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  function t(s: string): string {
    return lang === "pt" ? (pt[s] ?? s) : s;
  }

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
