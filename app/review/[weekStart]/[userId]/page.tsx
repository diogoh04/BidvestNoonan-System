import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import ReviewWeekLeaderClient from "./ReviewWeekLeaderClient";
import type { TimesheetDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getTimesheets(weekStart: string, userId: string): Promise<TimesheetDTO[]> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/timesheets?weekStart=${weekStart}&submittedByUserId=${userId}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  const all: TimesheetDTO[] = await res.json();
  return all.filter((t) => t.status !== "draft");
}

export default async function ReviewWeekLeaderPage({
  params,
}: {
  params: { weekStart: string; userId: string };
}) {
  const user = await getCurrentUser();
  const timesheets = await getTimesheets(params.weekStart, params.userId);
  if (timesheets.length === 0) notFound();

  return (
    <>
      <Header role={user?.role ?? "supervisor"} />
      <main className="mx-auto max-w-6xl px-6 py-10 print:max-w-none print:px-4 print:py-2">
        <ReviewWeekLeaderClient
          teamLeaderNome={timesheets[0].submittedByNome ?? "Conta removida"}
          initialTimesheets={timesheets}
        />
      </main>
    </>
  );
}
