import { headers } from "next/headers";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import Header from "@/components/Header";
import ReviewTabs from "@/components/ReviewTabs";
import DateRangeFilterForm from "@/components/DateRangeFilterForm";
import ReviewWeeksListClient from "./ReviewWeeksListClient";
import { getCurrentUser } from "@/lib/auth";
import type { TimesheetDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getSubmittedTimesheets(dateFrom?: string, dateTo?: string): Promise<TimesheetDTO[]> {
  const base = await getBaseUrl();
  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const qs = params.toString();
  const res = await fetch(`${base}/api/timesheets${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  const all: TimesheetDTO[] = await res.json();
  return all.filter((t) => t.status !== "draft");
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const user = await getCurrentUser();
  const { dateFrom, dateTo } = searchParams;
  const timesheets = await getSubmittedTimesheets(dateFrom, dateTo);

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

        <DateRangeFilterForm clearHref="/review" dateFrom={dateFrom} dateTo={dateTo} />

        <ReviewWeeksListClient initialRows={rows} />
      </main>
    </>
  );
}
