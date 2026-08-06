"use client";

import { HardHat, UserCheck, Contact } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatTile from "./StatTile";
import type { DashboardDTO } from "@/lib/types";

const PETROL = "#0d4f5c";
const SUCCESS = "#3f7a4a";
const DANGER = "#a3352b";
const LINE = "#dde3e3";

const tooltipStyle = {
  borderRadius: 6,
  border: `1px solid ${LINE}`,
  fontSize: 12,
  fontFamily: "var(--font-sans)",
};

function hoursDeltaLabel(delta: number) {
  if (delta > 0) return `Surplus ${delta}h`;
  if (delta < 0) return `Short ${Math.abs(delta)}h`;
  return "Hours OK";
}

function hoursDeltaColor(delta: number) {
  return delta < 0 ? "text-danger" : "text-success";
}

// Tooltip do gráfico "vagas em aberto por prédio": passar o mouse numa barra
// mostra o detalhamento por tamanho de hora daquele prédio (1 vaga de 20h,
// 2 de 15h...) em vez de só o total.
function BuildingSlotsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DashboardDTO["buildingsOpenSlots"][number] }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold text-ink">{row.nome}</div>
      <ul className="space-y-0.5">
        {row.breakdown.map((b) => (
          <li key={b.horas} className="text-ink/70">
            <span className="font-semibold text-ink">{b.count}</span> slot{b.count !== 1 ? "s" : ""} of {b.horas}h
          </li>
        ))}
      </ul>
    </div>
  );
}

// Tooltip do gráfico "vagas em aberto por tamanho de hora": passar o mouse
// numa coluna mostra o total daquele tamanho e, abaixo, em quais prédios.
function HourSizeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: DashboardDTO["openSlotsByHours"][number] }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-ink">
        {row.count} slot{row.count !== 1 ? "s" : ""} of {row.horas}h
      </div>
      <ul className="mt-1 space-y-0.5 border-t border-line pt-1">
        {row.buildings.map((b) => (
          <li key={b.buildingId} className="text-ink/70">
            <span className="font-semibold text-ink">{b.count}</span> · {b.nome}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardView({ data }: { data: DashboardDTO }) {
  const { counts, buildingsOpenSlots, openSlotsByHours, buildingsHoursBalance, grandTotal } = data;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={HardHat} label="Team Leaders" value={counts.totalTeamLeaders} />
        <StatTile icon={UserCheck} label="Cleaners in buildings" value={counts.totalCleaners} />
        <StatTile icon={Contact} label="Total Staff" value={counts.totalStaff} />
      </div>

      <section className="rounded-md border border-line bg-white p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-petrol">Open slots by building</h2>
        {buildingsOpenSlots.length === 0 ? (
          <p className="text-sm text-ink/50">No open slots at the moment.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, buildingsOpenSlots.length * 44)}>
            <BarChart data={buildingsOpenSlots} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke={LINE} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis dataKey="nome" type="category" width={140} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: "#f5f7f7" }} content={<BuildingSlotsTooltip />} />
              <Bar dataKey="openSlotsCount" fill={PETROL} radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                <LabelList dataKey="openSlotsCount" position="right" style={{ fill: "#12202b", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="rounded-md border border-line bg-white p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-petrol">Open slots by hour size</h2>
        {openSlotsByHours.length === 0 ? (
          <p className="text-sm text-ink/50">No open slots at the moment.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={openSlotsByHours} margin={{ top: 16 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="horas" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: "#f5f7f7" }} content={<HourSizeTooltip />} />
              <Bar dataKey="count" fill={PETROL} radius={[4, 4, 0, 0]} barSize={32} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" style={{ fill: "#12202b", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="rounded-md border border-line bg-white p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-petrol">Hours balance by building</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {buildingsHoursBalance.length === 0 ? (
            <p className="text-sm text-ink/50">
              {grandTotal.buildingsCounted === 0
                ? "No building with an hours limit configured."
                : "All buildings with an hours limit are balanced."}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(120, buildingsHoursBalance.length * 44)}>
              <BarChart data={buildingsHoursBalance} layout="vertical" margin={{ left: 8, right: 32 }}>
                <CartesianGrid horizontal={false} stroke={LINE} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="nome" type="category" width={140} tick={{ fontSize: 12 }} />
                <ReferenceLine x={0} stroke={LINE} />
                <Tooltip
                  cursor={{ fill: "#f5f7f7" }}
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [hoursDeltaLabel(value), ""]}
                />
                <Bar dataKey="hoursDelta" barSize={20} isAnimationActive={false}>
                  {buildingsHoursBalance.map((b) => (
                    <Cell key={b.buildingId} fill={b.hoursDelta < 0 ? DANGER : b.hoursDelta > 0 ? SUCCESS : LINE} />
                  ))}
                  <LabelList
                    dataKey="hoursDelta"
                    position="right"
                    formatter={(v: number) => `${v > 0 ? "+" : ""}${v}h`}
                    style={{ fill: "#12202b", fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="flex flex-col justify-center gap-3 rounded-md border border-line bg-surface p-6">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-ink/40">Total balance</div>
            {grandTotal.buildingsCounted === 0 ? (
              <div className="text-sm text-ink/50">No buildings with an hours limit configured.</div>
            ) : (
              <>
                <div className={`font-display text-4xl font-bold ${hoursDeltaColor(grandTotal.hoursDelta)}`}>
                  {hoursDeltaLabel(grandTotal.hoursDelta)}
                </div>
                <div className="text-xs text-ink/50">
                  {grandTotal.horasDisponiveis}h available - {grandTotal.horasGastas}h used, across{" "}
                  {grandTotal.buildingsCounted} building{grandTotal.buildingsCounted !== 1 ? "s" : ""}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
