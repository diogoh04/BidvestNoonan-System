import Link from "next/link";
import { headers } from "next/headers";
import Header from "@/components/Header";
import WeekNav from "@/components/WeekNav";
import MonthNav from "@/components/MonthNav";
import HoursViewToggle from "@/components/HoursViewToggle";
import { ChevronRight, Gauge } from "lucide-react";
import { getMonday, toISODate, getMonthKey, getMondaysInMonth, firstMondayOfMonth } from "@/lib/week";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getTeams() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/teams`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (!res.ok) return [];
  return res.json();
}

async function getBuildings() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/buildings`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (!res.ok) return [];
  return res.json();
}

async function getHoursLog(query: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/hours-log?${query}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}

function balanceLabel(balance: number) {
  return balance < 0 ? `Short ${Math.abs(balance)}h` : `Surplus ${balance}h`;
}

export default async function HoursControlPage({
  searchParams,
}: {
  searchParams: { view?: string; week?: string; month?: string };
}) {
  const view = searchParams.view === "month" ? "month" : "week";
  const weekStart = searchParams.week ?? toISODate(getMonday(new Date()));
  const month = searchParams.month ?? getMonthKey(new Date());
  const periodQuery = view === "month" ? `month=${month}` : `weekStart=${weekStart}`;
  const editWeek = view === "month" ? firstMondayOfMonth(month) : weekStart;
  // Cada segunda do período (só 1 no modo semana) — soma semana a semana em
  // vez de multiplicar o valor ao vivo, porque cada semana já lançada tem
  // seu próprio UCD Hours congelado (ver BuildingHoursLog.ucdHours no
  // schema.prisma); semana sem lançamento cai pro valor ao vivo do prédio.
  const mondays = view === "month" ? getMondaysInMonth(month) : [weekStart];

  const [teams, buildings, logs] = await Promise.all([getTeams(), getBuildings(), getHoursLog(periodQuery)]);

  const logsByBuilding = new Map<string, any[]>();
  for (const l of logs) {
    const arr = logsByBuilding.get(l.buildingId) ?? [];
    arr.push(l);
    logsByBuilding.set(l.buildingId, arr);
  }

  const unassigned = buildings.filter((b: any) => !b.teamId);

  function buildingRow(b: { id: string; nome: string; horasDisponiveis: number | null }) {
    const buildingLogs = logsByBuilding.get(b.id) ?? [];
    let budget: number | null = null;
    let spent: number | null = null;
    for (const monday of mondays) {
      const log = buildingLogs.find((l) => l.weekStart === monday);
      const ucd = log?.ucdHours ?? b.horasDisponiveis;
      if (ucd != null) budget = (budget ?? 0) + ucd;
      if (log) spent = (spent ?? 0) + log.hoursSpent;
    }
    const balance = budget != null && spent != null ? budget - spent : null;
    return { ...b, budget, spent, balance };
  }

  const teamGroups = teams.map((team: any) => ({
    ...team,
    rows: team.buildings.map(buildingRow),
  }));
  const unassignedRows = unassigned.map(buildingRow);

  const allRows = [...teamGroups.flatMap((t: any) => t.rows), ...unassignedRows];
  const grandBudget = allRows.reduce((s, r) => s + (r.budget ?? 0), 0);
  const grandSpent = allRows.reduce((s, r) => s + (r.spent ?? 0), 0);
  const grandBalance = grandBudget - grandSpent;

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Hours Control</h1>
            <p className="mt-1 text-sm text-ink/50">
              UCD Hours (budget) vs hours actually spent, by team. Click a team to log a different week.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <HoursViewToggle view={view} basePath="/hours-control" />
            {view === "week" ? (
              <WeekNav weekStart={weekStart} basePath="/hours-control" />
            ) : (
              <MonthNav month={month} basePath="/hours-control" />
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-6 rounded-md border border-line bg-surface px-5 py-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Total UCD Hours</p>
            <p className="font-display text-xl font-bold text-ink">{grandBudget}h</p>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Total Hours Spent</p>
            <p className="font-display text-xl font-bold text-ink">{grandSpent}h</p>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Balance</p>
            <p className={`font-display text-xl font-bold ${grandBalance < 0 ? "text-danger" : "text-success"}`}>
              {balanceLabel(grandBalance)}
            </p>
          </div>
        </div>

        {teams.length === 0 && <p className="mt-8 text-sm text-ink/40">No team registered yet.</p>}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {teamGroups.map((team: any) => {
            const totalBudget = team.rows.reduce((s: number, r: any) => s + (r.budget ?? 0), 0);
            const totalSpent = team.rows.reduce((s: number, r: any) => s + (r.spent ?? 0), 0);
            const balance = totalBudget - totalSpent;

            return (
              <Link
                key={team.id}
                href={`/hours-control/${team.id}?week=${editWeek}`}
                className="group flex flex-col overflow-hidden rounded-md border border-line bg-white transition hover:border-petrol hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-petrol px-2.5 py-1 font-display text-sm font-bold text-white">
                      Team {team.number ?? "—"}
                    </span>
                    <div>
                      <div className="font-medium text-ink">{team.leaderName ?? "No leader connected"}</div>
                      <div className="flex items-center gap-1 font-mono text-xs text-ink/50">
                        <Gauge size={11} />
                        {totalBudget}h budget · {totalSpent}h spent
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-ink/30 transition group-hover:text-petrol" />
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink/40">
                      <th className="px-4 py-2 font-medium">Building</th>
                      <th className="px-4 py-2 font-medium">UCD Hours</th>
                      <th className="px-4 py-2 font-medium">Spent</th>
                      <th className="px-4 py-2 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-ink/40">
                          No building allocated
                        </td>
                      </tr>
                    )}
                    {team.rows.map((r: any) => (
                      <tr key={r.id} className="border-t border-line/60">
                        <td className="px-4 py-2 text-ink">{r.nome}</td>
                        <td className="px-4 py-2 text-ink/70">{r.budget ?? "—"}</td>
                        <td className="px-4 py-2 text-ink/70">{r.spent ?? "—"}</td>
                        <td className={`px-4 py-2 ${r.balance == null ? "text-ink/30" : r.balance < 0 ? "text-danger" : "text-success"}`}>
                          {r.balance == null ? "—" : r.balance < 0 ? `-${Math.abs(r.balance)}h` : `+${r.balance}h`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-end gap-2 border-t border-line bg-surface px-4 py-2 text-sm font-medium">
                  <span className={balance < 0 ? "text-danger" : "text-success"}>{balanceLabel(balance)}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {unassignedRows.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 font-display text-lg font-bold text-ink/60">
              Buildings not allocated to any team ({unassignedRows.length})
            </h2>
            <p className="mb-3 text-sm text-ink/50">
              These don&apos;t show under a team yet, so they&apos;re not counted per team above — only in the total.
              Allocate them from the building&apos;s page or from a team.
            </p>
            <div className="overflow-hidden rounded-md border border-line bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink/40">
                    <th className="px-4 py-2 font-medium">Building</th>
                    <th className="px-4 py-2 font-medium">UCD Hours</th>
                    <th className="px-4 py-2 font-medium">Spent</th>
                    <th className="px-4 py-2 font-medium">Balance</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedRows.map((r: any) => (
                    <tr key={r.id} className="border-t border-line/60">
                      <td className="px-4 py-2 text-ink">{r.nome}</td>
                      <td className="px-4 py-2 text-ink/70">{r.budget ?? "—"}</td>
                      <td className="px-4 py-2 text-ink/70">{r.spent ?? "—"}</td>
                      <td className={`px-4 py-2 ${r.balance == null ? "text-ink/30" : r.balance < 0 ? "text-danger" : "text-success"}`}>
                        {r.balance == null ? "—" : r.balance < 0 ? `-${Math.abs(r.balance)}h` : `+${r.balance}h`}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/buildings/${r.id}`} className="text-xs text-petrol hover:underline">
                          Assign a team
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
