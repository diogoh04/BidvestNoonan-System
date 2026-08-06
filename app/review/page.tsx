import { headers } from "next/headers";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import { formatWeekRange } from "@/lib/week";
import type { TimesheetDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getSubmittedTimesheets(): Promise<TimesheetDTO[]> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/timesheets`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  const all: TimesheetDTO[] = await res.json();
  return all.filter((t) => t.status !== "draft");
}

export default async function ReviewPage() {
  const user = await getCurrentUser();
  const timesheets = await getSubmittedTimesheets();

  const byWeek = new Map<string, TimesheetDTO[]>();
  for (const t of timesheets) {
    byWeek.set(t.weekStart, [...(byWeek.get(t.weekStart) ?? []), t]);
  }
  const weeks = Array.from(byWeek.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <Header role={user?.role ?? "supervisor"} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Timesheets</h1>
            <p className="mt-1 text-sm text-ink/50">Select a week to see who has submitted.</p>
          </div>
          <Link
            href="/review/excluidas"
            className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
          >
            <Trash2 size={16} />
            View deleted
          </Link>
        </div>

        <div className="mt-6 space-y-2">
          {weeks.map(([weekStart, items]) => {
            const pending = items.filter((t) => t.status === "submitted").length;
            const teamLeaders = new Set(items.map((t) => t.submittedByUserId ?? "none"));
            return (
              <Link
                key={weekStart}
                href={`/review/${weekStart}`}
                className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
              >
                <div>
                  <div className="font-medium text-ink">Week {formatWeekRange(weekStart)}</div>
                  <div className="text-xs text-ink/40">{teamLeaders.size} team leader(s)</div>
                </div>
                {pending > 0 ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {pending} pending
                  </span>
                ) : (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-success">
                    All done
                  </span>
                )}
              </Link>
            );
          })}
          {weeks.length === 0 && <p className="text-sm text-ink/40">No timesheet submitted yet.</p>}
        </div>
      </main>
    </>
  );
}
