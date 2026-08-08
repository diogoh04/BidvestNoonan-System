"use client";

import { useMemo, useState } from "react";
import type { LeaveReason } from "@/lib/types";
import { LEAVE_REASON_LABELS } from "@/lib/types";

type P45StaffItem = {
  voluntaryLeave: boolean | null;
  leaveReason: LeaveReason | null;
};

type SliceKey = LeaveReason | "voluntary" | "unknown";

type Slice = {
  key: SliceKey;
  label: string;
  count: number;
  pct: number;
  color: string;
};

// Paleta categórica validada (ordem fixa — nunca reordenar/gerar cor nova,
// ver skill dataviz). "unknown" cobre P45 antigos, salvos antes deste campo
// existir, sem voluntaryLeave preenchido — sem essa fatia, o total não
// fecharia 100%.
const ORDER: SliceKey[] = ["voluntary", "absences", "transport", "productivity", "visa_blocked", "other", "unknown"];

const COLORS: Record<SliceKey, string> = {
  voluntary: "#2a78d6",
  absences: "#eb6834",
  transport: "#1baf7a",
  productivity: "#eda100",
  visa_blocked: "#e87ba4",
  other: "#008300",
  unknown: "#4a3aa7",
};

const LABELS: Record<SliceKey, string> = {
  voluntary: "Left by own choice",
  ...LEAVE_REASON_LABELS,
  unknown: "Unknown",
};

function buildSlices(list: P45StaffItem[]): { total: number; slices: Slice[] } {
  const total = list.length;
  const counts: Record<SliceKey, number> = {
    voluntary: 0,
    absences: 0,
    transport: 0,
    productivity: 0,
    visa_blocked: 0,
    other: 0,
    unknown: 0,
  };

  for (const s of list) {
    if (s.voluntaryLeave === true) counts.voluntary += 1;
    else if (s.voluntaryLeave === false && s.leaveReason) counts[s.leaveReason] += 1;
    else counts.unknown += 1;
  }

  const slices = ORDER.map((key) => ({
    key,
    label: LABELS[key],
    count: counts[key],
    pct: total > 0 ? Math.round((counts[key] / total) * 1000) / 10 : 0,
    color: COLORS[key],
  })).filter((s) => s.count > 0);

  return { total, slices };
}

// Barra única de 100% empilhada mostrando, do total de staff no P45, qual
// fatia saiu por conta própria e qual fatia saiu por cada motivo — todas as
// % somam (aprox.) 100% do total, conforme pedido (quem saiu por conta
// própria entra como mais uma categoria, não fica de fora do cálculo).
export default function P45ReportChart({ list }: { list: P45StaffItem[] }) {
  const { total, slices } = useMemo(() => buildSlices(list), [list]);
  const [hovered, setHovered] = useState<SliceKey | null>(null);

  if (total === 0) return null;

  return (
    <div className="rounded-md border border-line bg-white p-6">
      <h2 className="mb-1 font-display text-lg font-bold text-petrol">Leaving reasons report</h2>
      <p className="mb-4 text-sm text-ink/50">
        {total} staff in P45 · share of each departure reason, including staff who left by their own choice.
      </p>

      <div className="flex h-6 w-full overflow-hidden rounded-full bg-surface">
        {slices.map((s, i) => (
          <div
            key={s.key}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered((h) => (h === s.key ? null : h))}
            onFocus={() => setHovered(s.key)}
            onBlur={() => setHovered((h) => (h === s.key ? null : h))}
            tabIndex={0}
            role="img"
            aria-label={`${s.label}: ${s.count} staff, ${s.pct}%`}
            style={{
              width: `${s.pct}%`,
              backgroundColor: s.color,
              marginRight: i < slices.length - 1 ? 2 : 0,
            }}
            className="group relative h-full outline-none focus-visible:ring-2 focus-visible:ring-petrol"
          >
            {hovered === s.key && (
              <div className="pointer-events-none absolute -top-12 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-white px-2.5 py-1.5 text-xs shadow-md">
                <div className="font-semibold text-ink">
                  {s.count} staff ({s.pct}%)
                </div>
                <div className="text-ink/50">{s.label}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-ink">{s.label}</span>
            <span className="font-mono text-ink/40">
              {s.pct}% · {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
