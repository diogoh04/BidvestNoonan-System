import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import BuildingStaffClient from "./BuildingStaffClient";
import BuildingHoursCard from "@/components/BuildingHoursCard";
import WorkOrderCard from "@/components/WorkOrderCard";
import BuildingSlotsCard from "@/components/BuildingSlotsCard";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getBuilding(id: string) {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/buildings/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Falha ao carregar prédio");
  return res.json();
}

export default async function BuildingDetailPage({ params }: { params: { id: string } }) {
  const building = await getBuilding(params.id);
  if (!building) notFound();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Building</p>
            <h1 className="font-display text-2xl font-bold text-ink">{building.nome}</h1>
          </div>
          <BuildingHoursCard buildingId={building.id} initialHours={building.horasDisponiveis} />
          <WorkOrderCard buildingId={building.id} initialWorkOrder={building.workOrder} />
        </div>

        <div className="mt-4">
          <BuildingSlotsCard buildingId={building.id} initialSlots={building.slots} />
        </div>

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-petrol">
              Team Leader{building.teamLeaders.length !== 1 ? "s" : ""}
            </h2>
            <BuildingStaffClient staff={building.teamLeaders} emptyLabel="Nenhum team leader vinculado a este prédio." />
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-petrol">Cleaners</h2>
           <BuildingStaffClient
                staff={building.cleaners}
                emptyLabel="Nenhum cleaner alocado neste prédio."
                slots={building.slots}
                buildingId={building.id}/>
          </section>
        </div>
      </main>
    </>
  );
}
