import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import StaffRowClient from "./StaffListClient";
import BuildingHoursCard from "@/components/BuildingHoursCard";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getTeamLeader(id: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/team-leaders/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Falha ao carregar team leader");
  return res.json();
}

export default async function TeamLeaderDetailPage({ params }: { params: { id: string } }) {
  const teamLeader = await getTeamLeader(params.id);
  if (!teamLeader) notFound();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Team Leader</p>
        <h1 className="font-display text-2xl font-bold text-ink">{teamLeader.nome}</h1>
        <p className="mt-1 font-mono text-xs text-ink/50">#{teamLeader.staffNumber || "s/n"}</p>

        <div className="mt-8 space-y-8">
          {teamLeader.buildings.length === 0 && (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
              Nenhum prédio vinculado a este team leader.
            </p>
          )}

          {teamLeader.buildings.map((b: any) => (
            <section key={b.id}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-bold text-petrol">{b.nome}</h2>
                <BuildingHoursCard buildingId={b.id} initialHours={b.horasDisponiveis} />
              </div>
              <StaffRowClient staff={b.cleaners} />
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
