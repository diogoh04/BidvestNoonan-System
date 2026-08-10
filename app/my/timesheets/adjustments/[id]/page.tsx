import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { formatWeekRange, formatShortDate } from "@/lib/week";
import { TIMESHEET_DAYS, timesheetDayLabel } from "@/lib/types";
import type { AdjustmentDTO } from "@/lib/types";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getAdjustment(id: string): Promise<AdjustmentDTO | null> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/timesheets/adjustments/${id}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return null;
  return res.json();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

export default async function AdjustmentPage({ params }: { params: { id: string } }) {
  const adjustment = await getAdjustment(params.id);
  if (!adjustment) notFound();

  // Agrupa o diff (célula a célula) por linha (pessoa/vaga/cover) — mais
  // fácil de ler do que uma lista solta de células.
  const byRow = new Map<number, { nome: string | null; kind: string; cells: AdjustmentDTO["diff"] }>();
  for (const d of adjustment.diff) {
    const entry = byRow.get(d.rowIndex) ?? { nome: d.nome, kind: d.kind, cells: [] };
    entry.cells.push(d);
    byRow.set(d.rowIndex, entry);
  }
  const rows = Array.from(byRow.values());

  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Adjustments</p>
        <h1 className="font-display text-2xl font-bold text-ink">
          {adjustment.buildingNome} — Week {formatWeekRange(adjustment.weekStart)}
        </h1>
        <p className="mt-1 text-sm text-ink/50">
          Updated {formatDate(adjustment.updatedAt)}
          {adjustment.updatedByNome ? ` by ${adjustment.updatedByNome}` : ""} — {adjustment.diff.length} cell
          {adjustment.diff.length !== 1 ? "s" : ""} changed since this sheet was first sent.
        </p>

        <div className="mt-6 space-y-4">
          {rows.map((r, i) => (
            <div key={i} className="rounded-md border border-line bg-white p-4">
              <div className="mb-2 font-medium text-ink">{r.nome ?? (r.kind === "openSlot" ? "Open slot" : "—")}</div>
              <div className="space-y-1.5">
                {r.cells.map((c, j) => (
                  <div key={j} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-32 shrink-0 text-ink/50">
                      {timesheetDayLabel(c.day)} {formatShortDate(adjustment.weekStart, TIMESHEET_DAYS.indexOf(c.day as (typeof TIMESHEET_DAYS)[number]))}
                    </span>
                    <span className="w-10 shrink-0 font-mono text-xs uppercase text-ink/40">{c.field}</span>
                    <span className="text-ink/40 line-through">{c.before ?? "—"}</span>
                    <span className="text-ink/40">→</span>
                    <span className="font-medium text-ink">{c.after ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-ink/40">No changes recorded.</p>}
        </div>
      </main>
    </>
  );
}
