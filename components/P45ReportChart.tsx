"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildP45BuildingSlices,
  buildP45ReportSlices,
  type P45BuildingSlice,
  type P45Slice,
  type P45StaffItem,
} from "@/lib/p45Report";

const PETROL = "#0d4f5c";
const LINE = "#dde3e3";

function ReasonTooltip({ active, payload }: { active?: boolean; payload?: { payload: P45Slice }[] }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-ink">
        {s.count} staff ({s.pct}%)
      </div>
      <div className="text-ink/70">{s.label}</div>
    </div>
  );
}

function BuildingTooltip({ active, payload }: { active?: boolean; payload?: { payload: P45BuildingSlice }[] }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-ink">
        {s.count} staff ({s.pct}%)
      </div>
      <div className="text-ink/70">{s.label}</div>
    </div>
  );
}

// Painel esquerdo: última obra antes da saída. Mutuamente exclusivo (1
// prédio por staff) — por isso cabe num donut (soma das fatias = 100%),
// diferente do painel de motivos ao lado. A cor de cada fatia nunca é a
// única forma de identificá-la — sempre acompanhada do nome na legenda
// abaixo (ver dataviz skill: "identity never color alone").
function BuildingDonut({ list }: { list: P45StaffItem[] }) {
  const { total, slices } = useMemo(() => buildP45BuildingSlices(list), [list]);

  if (total === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-ink">By last building</h3>
      <div className="relative mx-auto" style={{ width: 200, height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="label"
              innerRadius={58}
              outerRadius={94}
              paddingAngle={slices.length > 1 ? 2 : 0}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<BuildingTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold text-ink">{total}</span>
          <span className="text-xs text-ink/50">staff</span>
        </div>
      </div>

      <ul className="mx-auto mt-4 max-w-[260px] space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-ink">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 text-ink/50">
              {s.count} · {s.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Painel direito: ranking por motivo — barras horizontais de magnitude (uma
// só cor, já que aqui a série é "por conta própria" + motivos, não
// identidade). Motivos não são mutuamente exclusivos (um staff pode ter
// mais de um), então isso NÃO vira donut — a soma pode passar de 100%.
function ReasonRanking({ list }: { list: P45StaffItem[] }) {
  const { total, slices } = useMemo(() => buildP45ReportSlices(list), [list]);

  if (total === 0) return null;

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-ink">By leaving reason</h3>
      <p className="mb-3 text-xs text-ink/40">
        A staff member can have more than one reason, so the total can add up to more than 100%.
      </p>
      <ResponsiveContainer width="100%" height={Math.max(120, slices.length * 44)}>
        <BarChart data={slices} layout="vertical" margin={{ left: 8, right: 32 }}>
          <CartesianGrid horizontal={false} stroke={LINE} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
          <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 12 }} />
          <Tooltip cursor={{ fill: "#f5f7f7" }} content={<ReasonTooltip />} />
          <Bar dataKey="pct" fill={PETROL} radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
            <LabelList
              dataKey="pct"
              position="right"
              formatter={(v: number) => `${v}%`}
              style={{ fill: "#12202b", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Dois painéis lado a lado — última obra (donut) e motivo de saída
// (ranking) — mesma fonte de dados (lib/p45Report.ts) compartilhada com o
// export em Excel (lib/excelExport.ts), pra garantir que os números batem.
export default function P45ReportChart({ list }: { list: P45StaffItem[] }) {
  if (list.length === 0) return null;

  return (
    <div className="rounded-md border border-line bg-white p-6">
      <h2 className="mb-1 font-display text-lg font-bold text-petrol">Leaving reasons report</h2>
      <p className="mb-6 text-sm text-ink/50">{list.length} staff in P45.</p>

      <div className="grid gap-8 lg:grid-cols-2">
        <BuildingDonut list={list} />
        <ReasonRanking list={list} />
      </div>
    </div>
  );
}
