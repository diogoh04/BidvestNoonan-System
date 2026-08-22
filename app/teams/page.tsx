import Link from "next/link";
import { headers } from "next/headers";
import Header from "@/components/Header";
import CreateTeamButton from "@/components/CreateTeamButton";
import DeleteTeamButton from "@/components/DeleteTeamButton";
import { Building2, ChevronRight } from "lucide-react";

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

export default async function TeamsPage() {
  const teams = await getTeams();

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Teams</h1>
            <p className="mt-1 text-sm text-ink/50">
              {teams.length} registered. Click a team to see and edit its buildings and leader(s).
            </p>
          </div>
          <CreateTeamButton />
        </div>

        <div className="mt-6 space-y-2">
          {teams.length === 0 && (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
              No team registered yet.
            </p>
          )}

          {teams.map((team: any) => (
            <div
              key={team.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
            >
              <Link href={`/teams/${team.id}`} className="flex flex-1 items-center gap-3">
                <span className="rounded-md bg-petrol px-2.5 py-1 font-display text-sm font-bold text-white">
                  Team {team.number ?? "—"}
                </span>
                <div>
                  <div className="font-medium text-ink">{team.leaderName ?? "No leader connected"}</div>
                  <div className="mt-0.5 flex items-center gap-x-3 font-mono text-xs text-ink/50">
                    {team.leaders.length > 1 && <span>{team.leaders.length} leaders</span>}
                    <span className="flex items-center gap-1 text-petrol">
                      <Building2 size={12} />
                      {team.buildings.length > 0 ? team.buildings.map((b: any) => b.nome).join(", ") : "No building"}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <DeleteTeamButton teamId={team.id} compact redirectAfterDelete={false} />
                <Link href={`/teams/${team.id}`}>
                  <ChevronRight size={18} className="text-ink/30" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
