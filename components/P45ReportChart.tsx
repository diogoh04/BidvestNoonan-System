"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildP45ReportSlices, type P45Slice, type P45StaffItem } from "@/lib/p45Report";

const PETROL = "#0d4f5c";
const LINE = "#dde3e3";

function ReportTooltip({ active, payload }: { active?: boolean; payload?: { payload: P45Slice }[] }) {
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

// Barras horizontais de magnitude — uma por categoria (por conta própria +
// os motivos), % do total de P45 que inclui aquela categoria. Mesmo padrão
// visual dos gráficos de components/DashboardView.tsx. A contagem em si
// (lib/p45Report.ts) é compartilhada com o export em Excel (lib/excelExport.ts).
export default function P45ReportChart({ list }: { list: P45StaffItem[] }) {
  const { total, slices } = useMemo(() => buildP45ReportSlices(list), [list]);

  if (total === 0) return null;

  return (
    <div className="rounded-md border border-line bg-white p-6">
      <h2 className="mb-1 font-display text-lg font-bold text-petrol">Leaving reasons report</h2>
      <p className="mb-4 text-sm text-ink/50">
        {total} staff in P45 · share of each departure reason (a staff member can have more than one reason, so
        the total can add up to more than 100%).
      </p>

      <ResponsiveContainer width="100%" height={Math.max(120, slices.length * 44)}>
        <BarChart data={slices} layout="vertical" margin={{ left: 8, right: 32 }}>
          <CartesianGrid horizontal={false} stroke={LINE} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
          <YAxis dataKey="label" type="category" width={150} tick={{ fontSize: 12 }} />
          <Tooltip cursor={{ fill: "#f5f7f7" }} content={<ReportTooltip />} />
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
