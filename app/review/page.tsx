import { headers } from "next/headers";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import Header from "@/components/Header";
import ReviewTabs from "@/components/ReviewTabs";
import { getCurrentUser } from "@/lib/auth";
import { formatWeekRange, formatFortnightRange } from "@/lib/week";
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

  // Uma linha por (quem enviou + semana) — Team N · nome do TL · quinzena.
  const byKey = new Map<string, { weekStart: string; userId: string; items: TimesheetDTO[] }>();
  for (const t of timesheets) {
    const userId = t.submittedByUserId ?? "none";
    const key = `${t.weekStart}|${userId}`;
    const entry = byKey.get(key) ?? { weekStart: t.weekStart, userId, items: [] };
    entry.items.push(t);
    byKey.set(key, entry);
  }
  const rows = Array.from(byKey.values()).sort(
    (a, b) => b.weekStart.localeCompare(a.weekStart) || a.userId.localeCompare(b.userId)
  );

  return (
    <>
      <Header role={user?.role ?? "supervisor"} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ReviewTabs active="timesheets" />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Fortnightly timesheets</h1>
            <p className="mt-1 text-sm text-ink/50">One line per team leader submission.</p>
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
          {rows.map((r) => {
            const first = r.items[0];
            const pending = r.items.some((t) => t.status === "submitted");
            const teamNum = first.submittedByTeamNumber;
            const range =
              first.periodType === "biweekly" ? formatFortnightRange(r.weekStart) : `Week ${formatWeekRange(r.weekStart)}`;
            return (
              <Link
                key={`${r.weekStart}-${r.userId}`}
                href={`/review/${r.weekStart}/${r.userId}`}
                className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
              >
                <div>
                  <div className="font-medium text-ink">
                    {teamNum != null ? `Team ${teamNum} · ` : ""}
                    {first.submittedByNome ?? "Removed account"}
                  </div>
                  <div className="text-xs text-ink/40">
                    {range} · {r.items.length} building{r.items.length !== 1 ? "s" : ""}
                  </div>
                </div>
                {pending ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Pending</span>
                ) : (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-success">Done</span>
                )}
              </Link>
            );
          })}
          {rows.length === 0 && <p className="text-sm text-ink/40">No timesheet submitted yet.</p>}
        </div>
      </main>
    </>
  );
}
