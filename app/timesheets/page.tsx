import Link from "next/link";
import { headers } from "next/headers";
import Header from "@/components/Header";
import { ChevronRight, ClipboardList, Users } from "lucide-react";
import TimesheetBuildingSearch from "./TimesheetBuildingSearch";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getTeamLeaders() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/team-leaders`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (!res.ok) return [];
  return res.json();
}

async function getBuildings() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/buildings`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (!res.ok) return [];
  return res.json();
}

export default async function TimesheetsPage() {
  const [teamLeaders, buildings] = await Promise.all([getTeamLeaders(), getBuildings()]);

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Sign In &amp; Sign Out Book</h1>
        <p className="mt-1 text-sm text-ink/50">
          Choose the team leader to generate the timesheet with all their buildings, or search
          directly by building (useful when a building has more than one team leader).
        </p>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-petrol">
            <Users size={18} />
            By Team Leader
          </h2>
          <div className="space-y-2">
            {teamLeaders.length === 0 && (
              <p className="text-sm text-ink/40">No team leader registered yet.</p>
            )}
            {teamLeaders.map((tl: any) => (
              <Link
                key={tl.id}
                href={`/timesheets/leader/${tl.id}`}
                className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-petrol" />
                  <div>
                    <div className="font-medium text-ink">{tl.nome}</div>
                    <div className="mt-0.5 font-mono text-xs text-ink/50">
                      {tl.buildings.length} building(s): {tl.buildings.map((b: any) => b.nome).join(", ")}
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-ink/30" />
              </Link>
            ))}
          </div>
        </section>

        <TimesheetBuildingSearch buildings={buildings} />
      </main>
    </>
  );
}
