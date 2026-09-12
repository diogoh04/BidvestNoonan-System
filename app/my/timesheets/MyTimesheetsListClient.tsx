"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { formatWeekRange, formatFortnightRange } from "@/lib/week";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TimesheetDTO, TimesheetStatus } from "@/lib/types";

const STATUS_LABEL: Record<TimesheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted — awaiting review",
  done: "Done",
};

const STATUS_CLASS: Record<TimesheetStatus, string> = {
  draft: "bg-surface text-ink/60",
  submitted: "bg-amber-50 text-amber-700",
  done: "bg-green-50 text-success",
};

function weekOverallStatus(items: TimesheetDTO[]): TimesheetStatus {
  if (items.some((t) => t.status === "draft")) return "draft";
  if (items.some((t) => t.status === "submitted")) return "submitted";
  return "done";
}

export default function MyTimesheetsListClient({
  initialTimesheets,
  periodTypeFilter,
  emptyLabel = "No timesheet logged yet.",
}: {
  initialTimesheets: TimesheetDTO[];
  // Restringe a lista a um tipo só — usado pra reaproveitar este componente
  // nas abas "Weekly sheets" (filter="weekly") e na seção de quinzenais
  // ainda não lançadas/legadas em "Fortnightly sheets" (filter="biweekly")
  // de MyTimesheetsHubClient. Sem filtro, mostra tudo (comportamento antigo).
  periodTypeFilter?: "weekly" | "biweekly";
  emptyLabel?: string;
}) {
  const { t } = useLanguage();
  const [timesheets, setTimesheets] = useState(initialTimesheets);
  const [deletingWeek, setDeletingWeek] = useState<string | null>(null);
  const [confirmingWeek, setConfirmingWeek] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = periodTypeFilter ? timesheets.filter((t) => t.periodType === periodTypeFilter) : timesheets;

  const byWeek = new Map<string, TimesheetDTO[]>();
  for (const t of filtered) {
    byWeek.set(t.weekStart, [...(byWeek.get(t.weekStart) ?? []), t]);
  }
  const weeks = Array.from(byWeek.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  async function deleteWeek(weekStart: string, items: TimesheetDTO[]) {
    setDeletingWeek(weekStart);
    setError(null);
    try {
      const results = await Promise.all(
        items.map((t) => fetch(`/api/timesheets/${t.id}`, { method: "DELETE" }))
      );
      if (results.some((r) => !r.ok)) throw new Error("Could not delete some buildings from this week");
      setTimesheets((prev) => prev.filter((t) => t.weekStart !== weekStart));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingWeek(null);
      setConfirmingWeek(null);
    }
  }

  return (
    <div className="mt-6 space-y-2">
      {error && <p className="text-sm text-danger">{t(error)}</p>}

      {weeks.map(([weekStart, items]) => {
        const status = weekOverallStatus(items);
        const canDelete = items.every((t) => t.status !== "done");
        const periodType = items[0]?.periodType ?? "weekly";
        const isBiweekly = periodType === "biweekly";
        const range = isBiweekly ? formatFortnightRange(weekStart) : formatWeekRange(weekStart);

        if (confirmingWeek === weekStart) {
          return (
            <div
              key={weekStart}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger bg-white px-4 py-3"
            >
              <span className="text-sm text-danger">
                {t("Delete the whole timesheet for the")} {isBiweekly ? t("fortnight") : t("week")} {t("of")} {range} (
                {items.length} {t("building(s)")})? {t("This action cannot be undone.")}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => deleteWeek(weekStart, items)}
                  disabled={deletingWeek === weekStart}
                  className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {t("Confirm")}
                </button>
                <button
                  onClick={() => setConfirmingWeek(null)}
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
                >
                  {t("Cancel")}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={weekStart}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
          >
            <Link href={`/my/timesheets/lancar?week=${weekStart}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">
                  {isBiweekly ? t("Fortnight") : t("Week")} {range}
                </span>
                {items.some((ts) => ts.fortnightPlanId) && (
                  <span className="rounded-full bg-petrolLight px-2 py-0.5 text-[11px] font-medium text-petrol">
                    {t("From fortnight")}
                  </span>
                )}
              </div>
              <div className="text-xs text-ink/40">
                {items.length} {t("building(s)")}
              </div>
            </Link>

            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}>
              {t(STATUS_LABEL[status])}
            </span>

            {canDelete && (
              <button
                onClick={() => setConfirmingWeek(weekStart)}
                title={t("Delete")}
                className="shrink-0 rounded-md p-2 text-ink/50 hover:bg-red-50 hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        );
      })}

      {weeks.length === 0 && <p className="text-sm text-ink/40">{t(emptyLabel)}</p>}
    </div>
  );
}
