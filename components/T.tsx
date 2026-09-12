"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

// Tradução pontual dentro de Server Components (que não podem chamar
// useLanguage() direto) — troca só o texto, sem converter a página inteira
// pra client component. Ex.: <T s="My Buildings" />.
export default function T({ s }: { s: string }) {
  const { t } = useLanguage();
  return <>{t(s)}</>;
}
