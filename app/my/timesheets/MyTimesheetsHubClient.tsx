"use client";

import { useState } from "react";
import Link from "next/link";
import MyTimesheetsListClient from "./MyTimesheetsListClient";
import { formatFortnightRange, formatWeekRange } from "@/lib/week";
import type { TimesheetDTO, FortnightPlanDTO, AdjustmentDTO } from "@/lib/types";

type Tab = "fortnightly" | "weekly" | "adjustments";

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "fortnightly", label: "Fortnightly sheets" },
  { value: "weekly", label: "Weekly sheets" },
  { value: "adjustments", label: "Adjustments" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

// Central de "My Timesheets": Start New (botão no page.tsx, ao lado deste
// componente) + 3 abas. Não existe componente de tabs no projeto — reusa o
// mesmo padrão de botões toggle já usado em StaffForm/LancarClient.
export default function MyTimesheetsHubClient({
  initialTimesheets,
  initialFortnightPlans,
  initialAdjustments,
}: {
  initialTimesheets: TimesheetDTO[];
  initialFortnightPlans: FortnightPlanDTO[];
  initialAdjustments: AdjustmentDTO[];
}) {
  const [tab, setTab] = useState<Tab>("fortnightly");

  const launchedPlans = [...initialFortnightPlans].sort((a, b) => b.fortnightStart.localeCompare(a.fortnightStart));
  const adjustments = [...initialAdjustments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {TAB_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTab(opt.value)}
            className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
              tab === opt.value
                ? "border-petrol bg-petrol text-white"
                : "border-line bg-white text-ink hover:border-petrol"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {tab === "fortnightly" && (
        <div className="mt-4 space-y-6">
          <div>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/40">In progress</h2>
            {/* Rascunhos ainda não lançados — inclui também quinzenais
                antigas (legado) já enviadas/concluídas, que continuam
                editáveis do jeito de sempre, sem Launch/Adjustment. */}
            <MyTimesheetsListClient
              initialTimesheets={initialTimesheets}
              periodTypeFilter="biweekly"
              emptyLabel="No fortnight in progress."
            />
          </div>

          <div>
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/40">Launched</h2>
            {launchedPlans.length === 0 ? (
              <p className="text-sm text-ink/40">No fortnight launched yet.</p>
            ) : (
              <div className="space-y-2">
                {launchedPlans.map((p) => (
                  <Link
                    key={p.id}
                    href={`/my/timesheets/fortnights/${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
                  >
                    <div>
                      <div className="font-medium text-ink">{formatFortnightRange(p.fortnightStart)}</div>
                      <div className="text-xs text-ink/40">
                        {p.buildingNome} · Launched {formatDate(p.launchedAt)}
                        {p.launchedByNome ? ` by ${p.launchedByNome}` : ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "weekly" && (
        <div className="mt-4">
          <MyTimesheetsListClient
            initialTimesheets={initialTimesheets}
            periodTypeFilter="weekly"
            emptyLabel="No week logged yet. Start a new fortnight and launch it to get started."
          />
        </div>
      )}

      {tab === "adjustments" && (
        <div className="mt-4 space-y-2">
          {adjustments.length === 0 && (
            <p className="text-sm text-ink/40">No adjustments — weekly sheets still match what was sent.</p>
          )}
          {adjustments.map((a) => (
            <Link
              key={a.id}
              href={`/my/timesheets/adjustments/${a.id}`}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
            >
              <div>
                <div className="font-medium text-ink">
                  {a.buildingNome} · Week {formatWeekRange(a.weekStart)}
                </div>
                <div className="text-xs text-ink/40">
                  Updated {formatDate(a.updatedAt)}
                  {a.updatedByNome ? ` by ${a.updatedByNome}` : ""}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                {a.diff.length} cell{a.diff.length !== 1 ? "s" : ""} changed
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
