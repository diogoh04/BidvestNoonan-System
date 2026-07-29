import Link from "next/link";
import Header from "@/components/Header";
import { ChevronRight, FileX2, ArrowRightLeft, ShieldAlert } from "lucide-react";

const CATEGORIES = [
  {
    slug: "p45",
    label: "P45",
    description: "Staff a ser demitido, aguardando baixa",
    icon: FileX2,
  },
  {
    slug: "le",
    label: "LE",
    description: "Staff transferido pra outro site da empresa",
    icon: ArrowRightLeft,
  },
  {
    slug: "blocked",
    label: "Visa Staff Blocked",
    description: "Staff bloqueado",
    icon: ShieldAlert,
  },
];

export default function OutrosPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Outros</h1>
        <p className="mt-1 text-sm text-ink/50">
          Staff que não está mais em atividade em nenhum prédio.
        </p>

        <div className="mt-6 space-y-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/outros/${c.slug}`}
              className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
            >
              <div className="flex items-center gap-3">
                <c.icon size={20} className="text-petrol" />
                <div>
                  <div className="font-medium text-ink">{c.label}</div>
                  <div className="mt-0.5 text-xs text-ink/50">{c.description}</div>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink/30" />
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
