import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import { formatWeekRange } from "@/lib/week";
import WeekLeadersListClient from "./WeekLeadersListClient";
import type { TimesheetDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getWeekTimesheets(weekStart: string): Promise<TimesheetDTO[]> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/timesheets?weekStart=${weekStart}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  const all: TimesheetDTO[] = await res.json();
  return all.filter((t) => t.status !== "draft");
}

export default async function ReviewWeekPage({ params }: { params: { weekStart: string } }) {
  const user = await getCurrentUser();
  const timesheets = await getWeekTimesheets(params.weekStart);
  if (timesheets.length === 0) notFound();

  return (
    <>
      <Header role={user?.role ?? "supervisor"} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Semana</p>
        <h1 className="font-display text-2xl font-bold text-ink">{formatWeekRange(params.weekStart)}</h1>

        <WeekLeadersListClient weekStart={params.weekStart} initialTimesheets={timesheets} />
      </main>
    </>
  );
}
