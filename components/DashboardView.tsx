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
  if (delta > 0) return `Sobrando ${delta}h`;
  if (delta < 0) return `Devendo ${Math.abs(delta)}h`;
  return "Horas OK";
}

function hoursDeltaColor(delta: number) {
  return delta < 0 ? "text-danger" : "text-success";
}

export default function DashboardView({ data }: { data: DashboardDTO }) {
  const { counts, buildingsOpenSlots, openSlotsByHours, buildingsHoursBalance, grandTotal } = data;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={HardHat} label="Team Leaders" value={counts.totalTeamLeaders} />
        <StatTile icon={UserCheck} label="Cleaners em prédios" value={counts.totalCleaners} />
        <StatTile icon={Contact} label="Total de Staff" value={counts.totalStaff} />
      </div>

      <section className="rounded-md border border-line bg-white p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-petrol">Vagas em aberto por prédio</h2>
        {buildingsOpenSlots.length === 0 ? (
          <p className="text-sm text-ink/50">Nenhuma vaga em aberto no momento.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, buildingsOpenSlots.length * 44)}>
            <BarChart data={buildingsOpenSlots} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke={LINE} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis dataKey="nome" type="category" width={140} tick={{ fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "#f5f7f7" }}
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value} vaga${value !== 1 ? "s" : ""}`, ""]}
              />
              <Bar dataKey="openSlotsCount" fill={PETROL} radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                <LabelList dataKey="openSlotsCount" position="right" style={{ fill: "#12202b", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="rounded-md border border-line bg-white p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-petrol">Vagas em aberto por tamanho de hora</h2>
        {openSlotsByHours.length === 0 ? (
          <p className="text-sm text-ink/50">Nenhuma vaga em aberto no momento.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={openSlotsByHours} margin={{ top: 16 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="horas" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "#f5f7f7" }}
                contentStyle={tooltipStyle}
                formatter={(value: number, _name, props) => [
                  `${value} vaga${value !== 1 ? "s" : ""} de ${props.payload.horas}h`,
                  "",
                ]}
              />
              <Bar dataKey="count" fill={PETROL} radius={[4, 4, 0, 0]} barSize={32} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" style={{ fill: "#12202b", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="rounded-md border border-line bg-white p-6">
        <h2 className="mb-4 font-display text-lg font-bold text-petrol">Balanço de horas por prédio</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {buildingsHoursBalance.length === 0 ? (
            <p className="text-sm text-ink/50">Nenhum prédio com limite de horas configurado.</p>
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
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-ink/40">Balanço total</div>
            {grandTotal.buildingsCounted === 0 ? (
              <div className="text-sm text-ink/50">Sem prédios com limite de horas configurado.</div>
            ) : (
              <>
                <div className={`font-display text-4xl font-bold ${hoursDeltaColor(grandTotal.hoursDelta)}`}>
                  {hoursDeltaLabel(grandTotal.hoursDelta)}
                </div>
                <div className="text-xs text-ink/50">
                  {grandTotal.horasDisponiveis}h disponíveis - {grandTotal.horasGastas}h gastas, em{" "}
                  {grandTotal.buildingsCounted} prédio{grandTotal.buildingsCounted !== 1 ? "s" : ""}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
