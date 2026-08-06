"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import CombinedTimesheetEditor from "@/components/timesheets/CombinedTimesheetEditor";
import type { TimesheetDTO } from "@/lib/types";

export default function ReviewWeekLeaderClient({
  teamLeaderNome,
  initialTimesheets,
}: {
  teamLeaderNome: string | null;
  initialTimesheets: TimesheetDTO[];
}) {
  const [timesheets, setTimesheets] = useState(initialTimesheets);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOne(updated: TimesheetDTO) {
    setTimesheets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  const pending = timesheets.filter((t) => t.status === "submitted").length;

  async function markAllDone() {
    setSaving(true);
    setError(null);
    try {
      const results = await Promise.all(
        timesheets
          .filter((t) => t.status === "submitted")
          .map((t) =>
            fetch(`/api/timesheets/${t.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "done" }),
            }).then((r) => (r.ok ? r.json() : null))
          )
      );
      results.forEach((r) => r && updateOne(r));
    } catch {
      setError("Could not mark as done");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        {error && <p className="text-sm text-danger">{error}</p>}
        {pending > 0 && (
          <button
            type="button"
            onClick={markAllDone}
            disabled={saving}
            className="ml-auto flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            Mark week as done ({pending})
          </button>
        )}
      </div>

      <CombinedTimesheetEditor teamLeaderNome={teamLeaderNome} timesheets={timesheets} onChanged={updateOne} readOnly />
    </div>
  );
}
