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

async function getTeamLeader(id: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/team-leaders/${id}`, { cache: "no-store", headers: { cookie: headers().get("cookie") ?? "" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Falha ao carregar team leader");
  return res.json();
}

export default async function LeaderTimesheetPage({ params }: { params: { id: string } }) {
  const teamLeader = await getTeamLeader(params.id);
  if (!teamLeader) notFound();

  return (
    <>
      <div className="print:hidden">
        <Header role="master" />
      </div>
      <LeaderTimesheetView teamLeader={teamLeader} />
    </>
  );
}
