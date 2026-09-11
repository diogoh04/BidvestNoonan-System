"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import MyTimesheetsListClient from "./MyTimesheetsListClient";
import { formatFortnightRange, formatWeekRange } from "@/lib/week";
import type { TimesheetDTO, FortnightPlanDTO, AdjustmentReportDTO } from "@/lib/types";

type Tab = "fortnightly" | "weekly" | "adjustments";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

const STATUS_CLASS: Record<AdjustmentReportDTO["status"], string> = {
  draft: "bg-surface text-ink/60",
  submitted: "bg-amber-50 text-amber-700",
  done: "bg-green-50 text-success",
};

// Central de "My Timesheets": abas Fortnightly / Weekly (legado) / Adjustments.
export default function MyTimesheetsHubClient({
  initialTimesheets,
  initialFortnightPlans,
  initialReports,
}: {
  initialTimesheets: TimesheetDTO[];
  initialFortnightPlans: FortnightPlanDTO[];
  initialReports: AdjustmentReportDTO[];
}) {
  const [tab, setTab] = useState<Tab>("fortnightly");
  const [reports, setReports] = useState(
    [...initialReports].sort((a, b) => {
      const rank = (s: AdjustmentReportDTO["status"]) => (s === "submitted" ? 0 : s === "draft" ? 1 : 2);
      return rank(a.status) - rank(b.status) || b.weekStart.localeCompare(a.weekStart);
    })
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const hasLegacyWeekly = initialTimesheets.some((t) => t.periodType === "weekly");
  const launchedPlans = [...initialFortnightPlans].sort((a, b) => b.fortnightStart.localeCompare(a.fortnightStart));

  async function deleteReport(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/adjustment-reports/${id}`, { method: "DELETE" });
      if (res.ok) setReports((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: "fortnightly", label: "Fortnightly sheets" },
    ...(hasLegacyWeekly ? ([{ value: "weekly", label: "Weekly (legacy)" }] as const) : []),
    { value: "adjustments", label: "Adjustments" },
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((opt) => (
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
          <MyTimesheetsListClient
            initialTimesheets={initialTimesheets}
            periodTypeFilter="biweekly"
            emptyLabel="No fortnight logged yet. Use “New fortnight”."
          />

          {launchedPlans.length > 0 && (
            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/40">Launched (legacy)</h2>
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
            </div>
          )}
        </div>
      )}

      {tab === "weekly" && (
        <div className="mt-4">
          <MyTimesheetsListClient
            initialTimesheets={initialTimesheets}
            periodTypeFilter="weekly"
            emptyLabel="No weekly sheet."
          />
        </div>
      )}

      {tab === "adjustments" && (
        <div className="mt-4 space-y-3">
          <Link
            href="/my/timesheets/adjustments/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-petrol px-3 py-2 text-sm font-medium text-white hover:bg-petrolDark"
          >
            <Plus size={15} />
            New adjustment
          </Link>

          {reports.length === 0 && <p className="text-sm text-ink/40">No adjustment reports yet.</p>}

          <div className="space-y-2">
            {reports.map((r) =>
              confirmingId === r.id ? (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger bg-white px-4 py-3"
                >
                  <span className="text-sm text-danger">
                    Delete the adjustment report for week {formatWeekRange(r.weekStart)}?
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => deleteReport(r.id)}
                      disabled={deletingId === r.id}
                      className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
                >
                  <Link href={`/my/timesheets/adjustments/${r.id}`} className="min-w-0 flex-1">
                    <div className="font-medium text-ink">Week {formatWeekRange(r.weekStart)}</div>
                    <div className="text-xs text-ink/40">
                      {r.itemCount} item{r.itemCount !== 1 ? "s" : ""}
                      {r.groups.length > 0 ? ` · ${r.groups.map((g) => g.buildingNome).join(", ")}` : ""}
                    </div>
                  </Link>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                    {r.status}
                  </span>
                  {r.status === "draft" && (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(r.id)}
                      title="Delete report"
                      className="shrink-0 rounded-md p-2 text-ink/40 hover:bg-red-50 hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
