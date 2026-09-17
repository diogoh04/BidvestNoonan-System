import { headers } from "next/headers";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Header from "@/components/Header";
import DateRangeFilterForm from "@/components/DateRangeFilterForm";
import { getCurrentUser } from "@/lib/auth";
import ExcluidasListClient from "./ExcluidasListClient";
import type { TimesheetDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getDeletedTimesheets(dateFrom?: string, dateTo?: string): Promise<TimesheetDTO[]> {
  const base = await getBaseUrl();
  const params = new URLSearchParams({ deleted: "1" });
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const res = await fetch(`${base}/api/timesheets?${params.toString()}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function ExcluidasPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const user = await getCurrentUser();
  const { dateFrom, dateTo } = searchParams;
  const timesheets = await getDeletedTimesheets(dateFrom, dateTo);

  return (
    <>
      <Header role={user?.role ?? "supervisor"} />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link href="/review" className="flex items-center gap-1 text-sm text-ink/50 hover:text-petrol">
          <ChevronLeft size={16} />
          Timesheets
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">Deleted timesheets</h1>
        <p className="mt-1 text-sm text-ink/50">
          Deleted by Master or Supervisor. Can be restored if done by mistake, or permanently removed (e.g. test data).
        </p>

        <DateRangeFilterForm clearHref="/review/excluidas" dateFrom={dateFrom} dateTo={dateTo} />

        <ExcluidasListClient initialTimesheets={timesheets} />
      </main>
    </>
  );
}
