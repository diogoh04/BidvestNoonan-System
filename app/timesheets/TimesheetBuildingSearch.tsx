"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Building2 } from "lucide-react";

type Building = { id: string; nome: string; totalCleaners: number; totalTeamLeaders: number };

export default function TimesheetBuildingSearch({ buildings }: { buildings: Building[] }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? buildings.filter((b) => b.nome.toLowerCase().includes(query.trim().toLowerCase()))
    : buildings;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-petrol">
        <Building2 size={18} />
        Por Prédio
      </h2>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar prédio..."
        className="mb-3 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-petrol"
      />

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-ink/40">Nenhum prédio encontrado.</p>
        )}
        {filtered.map((b) => (
          <Link
            key={b.id}
            href={`/timesheets/${b.id}`}
            className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
          >
            <div>
              <div className="font-medium text-ink">{b.nome}</div>
              <div className="mt-0.5 font-mono text-xs text-ink/50">
                {b.totalTeamLeaders} team leader(s) · {b.totalCleaners} cleaner(s)
              </div>
            </div>
            <ChevronRight size={18} className="text-ink/30" />
          </Link>
        ))}
      </div>
    </section>
  );
}
