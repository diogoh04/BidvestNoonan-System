import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, User } from "lucide-react";
import Header from "@/components/Header";
import { formatWeekRange } from "@/lib/week";
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
  const timesheets = await getWeekTimesheets(params.weekStart);
  if (timesheets.length === 0) notFound();

  const byLeader = new Map<string, { username: string; items: TimesheetDTO[] }>();
  for (const t of timesheets) {
    if (!t.submittedByUserId) continue;
    const entry = byLeader.get(t.submittedByUserId) ?? { username: t.submittedByNome ?? "—", items: [] };
    entry.items.push(t);
    byLeader.set(t.submittedByUserId, entry);
  }
  const leaders = Array.from(byLeader.entries()).sort((a, b) => a[1].username.localeCompare(b[1].username));

  return (
    <>
      <Header role="supervisor" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Semana</p>
        <h1 className="font-display text-2xl font-bold text-ink">{formatWeekRange(params.weekStart)}</h1>

        <div className="mt-6 space-y-2">
          {leaders.map(([userId, { username, items }]) => {
            const pending = items.filter((t) => t.status === "submitted").length;
            return (
              <Link
                key={userId}
                href={`/review/${params.weekStart}/${userId}`}
                className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
              >
                <div className="flex items-center gap-3">
                  <User size={18} className="text-petrol" />
                  <div>
                    <div className="font-medium text-ink">{username}</div>
                    <div className="text-xs text-ink/40">{items.length} prédio(s)</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pending > 0 ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      Pendente
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-success">
                      Concluído
                    </span>
                  )}
                  <ChevronRight size={18} className="text-ink/30" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
