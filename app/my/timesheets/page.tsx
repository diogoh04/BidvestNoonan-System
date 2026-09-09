import { headers } from "next/headers";
import Link from "next/link";
import { FilePlus } from "lucide-react";
import Header from "@/components/Header";
import MyTimesheetsHubClient from "./MyTimesheetsHubClient";
import type { TimesheetDTO, FortnightPlanDTO, AdjustmentReportDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getJson<T>(path: string, fallback: T): Promise<T> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return fallback;
  return res.json();
}

export default async function MyTimesheetsPage() {
  const [timesheets, fortnightPlans, reports] = await Promise.all([
    getJson<TimesheetDTO[]>("/api/timesheets", []),
    getJson<FortnightPlanDTO[]>("/api/timesheets/fortnight-plans", []),
    getJson<AdjustmentReportDTO[]>("/api/adjustment-reports", []),
  ]);

  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">My Timesheets</h1>
            <p className="mt-1 text-sm text-ink/50">Start a new fortnight, or review what&apos;s already logged.</p>
          </div>
          <Link
            href="/my/timesheets/lancar?new=1"
            className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
          >
            <FilePlus size={16} />
            New fortnight
          </Link>
        </div>

        <MyTimesheetsHubClient
          initialTimesheets={timesheets}
          initialFortnightPlans={fortnightPlans}
          initialReports={reports}
        />
      </main>
    </>
  );
}
