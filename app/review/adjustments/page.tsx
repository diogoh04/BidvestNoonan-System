import { headers } from "next/headers";
import Header from "@/components/Header";
import ReviewTabs from "@/components/ReviewTabs";
import DateRangeFilterForm from "@/components/DateRangeFilterForm";
import ReviewAdjustmentsListClient from "./ReviewAdjustmentsListClient";
import { getCurrentUser } from "@/lib/auth";
import type { AdjustmentReportDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getReports(dateFrom?: string, dateTo?: string): Promise<AdjustmentReportDTO[]> {
  const base = await getBaseUrl();
  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const qs = params.toString();
  const res = await fetch(`${base}/api/adjustment-reports${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function ReviewAdjustmentsPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const user = await getCurrentUser();
  const { dateFrom, dateTo } = searchParams;
  const reports = await getReports(dateFrom, dateTo);

  return (
    <>
      <Header role={user?.role ?? "supervisor"} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ReviewTabs active="adjustments" />

        <h1 className="font-display text-2xl font-bold text-ink">Adjustments</h1>
        <p className="mt-1 text-sm text-ink/50">
          Weekly reports of changes team leaders made after sending a forecast. Review each and mark it done.
        </p>

        <DateRangeFilterForm clearHref="/review/adjustments" dateFrom={dateFrom} dateTo={dateTo} />

        <ReviewAdjustmentsListClient initialReports={reports} />
      </main>
    </>
  );
}
