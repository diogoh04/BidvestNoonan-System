import { headers } from "next/headers";
import Link from "next/link";
import Header from "@/components/Header";
import ReviewTabs from "@/components/ReviewTabs";
import { getCurrentUser } from "@/lib/auth";
import { formatWeekRange } from "@/lib/week";
import type { AdjustmentReportDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getReports(): Promise<AdjustmentReportDTO[]> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/adjustment-reports`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

export default async function ReviewAdjustmentsPage() {
  const user = await getCurrentUser();
  const reports = await getReports();

  const pending = reports.filter((r) => r.status === "submitted");
  const done = reports.filter((r) => r.status === "done");

  function row(r: AdjustmentReportDTO) {
    return (
      <Link
        key={r.id}
        href={`/review/adjustments/${r.id}`}
        className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
      >
        <div>
          <div className="font-medium text-ink">
            {r.submittedByTeamNumber != null ? `Team ${r.submittedByTeamNumber} · ` : ""}
            {r.submittedByNome ?? "—"} · Week {formatWeekRange(r.weekStart)}
          </div>
          <div className="text-xs text-ink/40">
            {r.itemCount} item{r.itemCount !== 1 ? "s" : ""}
            {r.groups.length > 0 ? ` · ${r.groups.map((g) => g.buildingNome).join(", ")}` : ""}
            {r.submittedAt ? ` · sent ${formatDate(r.submittedAt)}` : ""}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            r.status === "done" ? "bg-green-50 text-success" : "bg-amber-50 text-amber-700"
          }`}
        >
          {r.status === "done" ? "Done" : "Pending"}
        </span>
      </Link>
    );
  }

  return (
    <>
      <Header role={user?.role ?? "supervisor"} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ReviewTabs active="adjustments" />

        <h1 className="font-display text-2xl font-bold text-ink">Adjustments</h1>
        <p className="mt-1 text-sm text-ink/50">
          Weekly reports of changes team leaders made after sending a forecast. Review each and mark it done.
        </p>

        {reports.length === 0 && <p className="mt-6 text-sm text-ink/40">No adjustment reports yet.</p>}

        {pending.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/40">Pending</h2>
            <div className="space-y-2">{pending.map(row)}</div>
          </div>
        )}

        {done.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-widest text-ink/40">Done</h2>
            <div className="space-y-2">{done.map(row)}</div>
          </div>
        )}
      </main>
    </>
  );
}
