import { headers } from "next/headers";
import Link from "next/link";
import Header from "@/components/Header";
import { formatWeekRange } from "@/lib/week";
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
  const timesheets = await getSubmittedTimesheets();

  const byWeek = new Map<string, TimesheetDTO[]>();
  for (const t of timesheets) {
    byWeek.set(t.weekStart, [...(byWeek.get(t.weekStart) ?? []), t]);
  }
  const weeks = Array.from(byWeek.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <Header role="supervisor" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Folhas de Ponto</h1>
        <p className="mt-1 text-sm text-ink/50">Selecione uma semana pra ver quem já enviou.</p>

        <div className="mt-6 space-y-2">
          {weeks.map(([weekStart, items]) => {
            const pending = items.filter((t) => t.status === "submitted").length;
            const teamLeaders = new Set(items.map((t) => t.submittedByUserId).filter(Boolean));
            return (
              <Link
                key={weekStart}
                href={`/review/${weekStart}`}
                className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
              >
                <div>
                  <div className="font-medium text-ink">Semana {formatWeekRange(weekStart)}</div>
                  <div className="text-xs text-ink/40">{teamLeaders.size} team leader(s)</div>
                </div>
                {pending > 0 ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {pending} pendente(s)
                  </span>
                ) : (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-success">
                    Tudo concluído
                  </span>
                )}
              </Link>
            );
          })}
          {weeks.length === 0 && <p className="text-sm text-ink/40">Nenhuma folha enviada ainda.</p>}
        </div>
      </main>
    </>
  );
}
