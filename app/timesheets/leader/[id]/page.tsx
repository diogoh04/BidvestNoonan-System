import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import LeaderTimesheetView from "./LeaderTimesheetView";

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

export default async function LeaderTimesheetPage({ params }: { params: { id: string } }) {
  const team = await getTeam(params.id);
  if (!team) notFound();

  // LeaderTimesheetView espera o formato antigo ("teamLeader") — o time vira
  // essa mesma forma. Com mais de um líder, junta os nomes (nome já vem
  // assim de team.leaderName); staffNumber só faz sentido pra um, então usa
  // o primeiro líder conectado (pode ser nulo se o time ainda não tem líder).
  const teamLeader = {
    id: team.id,
    nome: team.leaderName,
    staffNumber: team.leaders[0]?.staffNumber ?? null,
    buildings: team.buildings,
  };

  return (
    <>
      <div className="print:hidden">
        <Header role="master" />
      </div>
      <LeaderTimesheetView teamLeader={teamLeader} />
    </>
  );
}
