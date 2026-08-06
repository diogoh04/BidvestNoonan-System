"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { formatWeekRange } from "@/lib/week";
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

export default function MyTimesheetsListClient({ initialTimesheets }: { initialTimesheets: TimesheetDTO[] }) {
  const [timesheets, setTimesheets] = useState(initialTimesheets);
  const [deletingWeek, setDeletingWeek] = useState<string | null>(null);
  const [confirmingWeek, setConfirmingWeek] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byWeek = new Map<string, TimesheetDTO[]>();
  for (const t of timesheets) {
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
      {error && <p className="text-sm text-danger">{error}</p>}

      {weeks.map(([weekStart, items]) => {
        const status = weekOverallStatus(items);
        const canDelete = items.every((t) => t.status !== "done");

        if (confirmingWeek === weekStart) {
          return (
            <div
              key={weekStart}
              className="flex items-center justify-between gap-3 rounded-md border border-danger bg-white px-4 py-3"
            >
              <span className="text-sm text-danger">
                Delete the whole timesheet for the week of {formatWeekRange(weekStart)} ({items.length} building(s))?
                This action cannot be undone.
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => deleteWeek(weekStart, items)}
                  disabled={deletingWeek === weekStart}
                  className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmingWeek(null)}
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-surface"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={weekStart}
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
          >
            <Link href={`/my/timesheets/lancar?week=${weekStart}`} className="flex-1">
              <div className="font-medium text-ink">Week {formatWeekRange(weekStart)}</div>
              <div className="text-xs text-ink/40">{items.length} building(s)</div>
            </Link>

            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASS[status]}`}>
              {STATUS_LABEL[status]}
            </span>

            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/my/timesheets/lancar?week=${weekStart}`}
                title="Edit"
                className="rounded-md p-2 text-ink/50 hover:bg-petrolLight hover:text-petrol"
              >
                <Pencil size={16} />
              </Link>
              {canDelete && (
                <button
                  onClick={() => setConfirmingWeek(weekStart)}
                  title="Delete"
                  className="rounded-md p-2 text-ink/50 hover:bg-red-50 hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {weeks.length === 0 && (
        <p className="text-sm text-ink/40">
          No timesheet logged yet.{" "}
          <Link href="/my/timesheets/lancar" className="text-petrol hover:underline">
            Log timesheet
          </Link>{" "}
          to get started.
        </p>
      )}
    </div>
  );
}
