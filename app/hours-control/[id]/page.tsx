import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import WeekNav from "@/components/WeekNav";
import HoursControlTable from "@/components/HoursControlTable";
import { getMonday, toISODate } from "@/lib/week";
import { ArrowLeft } from "lucide-react";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getTeam(id: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/teams/${id}`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load team");
  return res.json();
}

async function getHoursLog(weekStart: string, buildingIds: string[]) {
  if (buildingIds.length === 0) return [];
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/hours-log?weekStart=${weekStart}&buildingIds=${buildingIds.join(",")}`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function HoursControlTeamPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { week?: string };
}) {
  const team = await getTeam(params.id);
  if (!team) notFound();

  const weekStart = searchParams.week ?? toISODate(getMonday(new Date()));
  const buildingIds = team.buildings.map((b: any) => b.id);
  const logs = await getHoursLog(weekStart, buildingIds);
  const spentByBuilding = new Map<string, number>(logs.map((l: any) => [l.buildingId, l.hoursSpent]));

  const rows = team.buildings.map((b: any) => ({
    id: b.id,
    nome: b.nome,
    horasDisponiveis: b.horasDisponiveis,
    hoursSpent: spentByBuilding.get(b.id) ?? null,
  }));

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/hours-control" className="flex items-center gap-1.5 text-sm text-ink/50 hover:text-petrol">
          <ArrowLeft size={14} />
          Hours Control
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-petrol px-2.5 py-1 font-display text-sm font-bold text-white">
              Team {team.number ?? "—"}
            </span>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Team Leader</p>
              <h1 className="font-display text-xl font-bold text-ink">{team.leaderName ?? "No leader connected"}</h1>
            </div>
          </div>
          <WeekNav weekStart={weekStart} basePath={`/hours-control/${team.id}`} />
        </div>

        <div className="mt-6 overflow-x-auto rounded-md border border-line bg-white">
          {/* key força remontar ao trocar de semana — sem isso o estado local
              (useState(initialRows)) não ressincroniza com os novos rows/
              weekStart vindos do servidor, e a tabela continuaria mostrando
              (e salvando) os dados da semana anterior. */}
          <HoursControlTable key={weekStart} weekStart={weekStart} rows={rows} />
        </div>
      </main>
    </>
  );
}
