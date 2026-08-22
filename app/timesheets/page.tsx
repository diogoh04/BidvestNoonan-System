import Link from "next/link";
import { headers } from "next/headers";
import Header from "@/components/Header";
import { Building2, ChevronRight, Users } from "lucide-react";

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

export default async function TimesheetsPage() {
  const teams = await getTeams();

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Sign In &amp; Sign Out Book</h1>
        <p className="mt-1 text-sm text-ink/50">Pick a team to open the sign-in/out sheet with all their buildings.</p>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-petrol">
            <Users size={18} />
            By Team
          </h2>

          {teams.length === 0 && <p className="text-sm text-ink/40">No team registered yet.</p>}

          <div className="space-y-2">
            {teams.map((team: any) => (
              <Link
                key={team.id}
                href={`/timesheets/leader/${team.id}`}
                className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-petrol px-2.5 py-1 font-display text-sm font-bold text-white">
                    Team {team.number ?? "—"}
                  </span>
                  <div>
                    <div className="font-medium text-ink">{team.leaderName ?? "No leader connected"}</div>
                    <div className="mt-0.5 flex items-center gap-x-3 font-mono text-xs text-ink/50">
                      {team.leaders.length > 1 && <span>{team.leaders.length} leaders</span>}
                      <span className="flex items-center gap-1 text-petrol">
                        <Building2 size={12} />
                        {team.buildings.length} building(s)
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-ink/30" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
