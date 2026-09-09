import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Header from "@/components/Header";
import ReviewTabs from "@/components/ReviewTabs";
import AdjustmentReportView from "@/components/AdjustmentReportView";
import MarkAdjustmentDoneButton from "./MarkAdjustmentDoneButton";
import { getCurrentUser } from "@/lib/auth";
import type { AdjustmentReportDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getReport(id: string): Promise<AdjustmentReportDTO | null> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/adjustment-reports/${id}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return null;
  return res.json();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

export default async function ReviewAdjustmentReportPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const report = await getReport(params.id);
  if (!report) notFound();

  return (
    <>
      <Header role={user?.role ?? "supervisor"} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ReviewTabs active="adjustments" />

        <Link
          href="/review/adjustments"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink/50 hover:text-petrol"
        >
          <ChevronLeft size={16} />
          Adjustments
        </Link>

        <p className="flex flex-wrap items-center gap-2 text-sm text-ink/50">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              report.status === "done" ? "bg-green-50 text-success" : "bg-amber-50 text-amber-700"
            }`}
          >
            {report.status === "done" ? "Done" : "Pending"}
          </span>
          <span>
            {report.submittedByNome ? `${report.submittedByNome} · ` : ""}
            {report.submittedAt ? `sent ${formatDate(report.submittedAt)}` : ""}
            {report.status === "done" && report.reviewedByNome ? ` · reviewed by ${report.reviewedByNome}` : ""}
          </span>
        </p>

        <div className="mt-4">
          <AdjustmentReportView report={report} />
        </div>

        {report.status === "submitted" && (
          <div className="mt-6">
            <MarkAdjustmentDoneButton reportId={report.id} />
          </div>
        )}
      </main>
    </>
  );
}
