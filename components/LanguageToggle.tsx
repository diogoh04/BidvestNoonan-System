"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Só aparece pra conta "team_leader" (ver Header) — troca só a interface;
// a folha de ponto em si (Sign In & Sign Out Book) continua em inglês de
// propósito, é o documento oficial. Preferência salva no localStorage do
// navegador (ver LanguageContext), não na conta — troca na hora, sem
// deslogar.
export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div
      title="Language / Idioma"
      className="flex items-center gap-1 rounded-md border border-line px-1 py-1 sm:px-1.5"
    >
      <Languages size={14} className="ml-0.5 text-ink/40" />
      {(["en", "pt"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase transition ${
            lang === l ? "bg-petrol text-white" : "text-ink/50 hover:text-petrol"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
