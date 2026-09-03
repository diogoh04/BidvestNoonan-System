import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import TeamBuildingsOrderList from "@/components/TeamBuildingsOrderList";
import TeamNumberCard from "@/components/TeamNumberCard";
import ConnectTeamLeaderCard from "@/components/ConnectTeamLeaderCard";
import TeamLeaderCoversCard from "@/components/TeamLeaderCoversCard";
import AddBuildingToTeamCard from "@/components/AddBuildingToTeamCard";
import DeleteTeamButton from "@/components/DeleteTeamButton";
import { ClipboardList } from "lucide-react";

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

async function getBuildings() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/buildings`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (!res.ok) return [];
  return res.json();
}

export default async function TeamDetailPage({ params }: { params: { id: string } }) {
  const [team, allBuildings] = await Promise.all([getTeam(params.id), getBuildings()]);
  if (!team) notFound();

  const teamBuildingIds = new Set(team.buildings.map((b: any) => b.id));
  const availableBuildings = allBuildings.filter((b: any) => !teamBuildingIds.has(b.id));

  return (
    <>
      <Header role="master" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <TeamNumberCard teamId={team.id} initialNumber={team.number} />
            <ConnectTeamLeaderCard teamId={team.id} initialLeaders={team.leaders} />
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/timesheets/leader/${team.id}`}
              className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink transition hover:border-petrol hover:text-petrol"
            >
              <ClipboardList size={15} />
              Sign in/out sheet
            </Link>
            <DeleteTeamButton teamId={team.id} />
          </div>
        </div>

        <TeamLeaderCoversCard teamId={team.id} initialCovers={team.leaderCovers} />

        <div className="mt-6">
          <AddBuildingToTeamCard teamId={team.id} availableBuildings={availableBuildings} />
        </div>

        <div className="mt-8">
          {team.buildings.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
              No building allocated to this team yet.
            </p>
          ) : (
            <TeamBuildingsOrderList teamId={team.id} initialBuildings={team.buildings} />
          )}
        </div>
      </main>
    </>
  );
}
