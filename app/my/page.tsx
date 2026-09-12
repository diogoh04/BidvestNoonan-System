import { headers } from "next/headers";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import Header from "@/components/Header";
import BuildingStaffClient from "@/components/BuildingStaffClient";
import T from "@/components/T";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getMyProfile() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/my/buildings`, {
    cache: "no-store",
    headers: { cookie: headers().get("cookie") ?? "" },
  });
  // 403 = conta "team_leader" ainda sem time vinculado (ver User.teamId) —
  // sinaliza pra mostrar um aviso em vez de "0 buildings" sem explicação.
  if (!res.ok) return { nome: null, buildings: [], noTeam: res.status === 403 };
  return { ...(await res.json()), noTeam: false };
}

export default async function MyBuildingsPage() {
  const profile = await getMyProfile();
  const buildings = profile.buildings ?? [];

  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">
              <T s="My Buildings" />
            </h1>
            <p className="mt-1 text-sm text-ink/50">
              {buildings.length} <T s="building(s) under your responsibility." />
            </p>
          </div>
          <Link
            href="/my/timesheets"
            className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
          >
            <ClipboardList size={16} />
            <T s="My Timesheets" />
          </Link>
        </div>

        <div className="mt-8 space-y-8">
          {profile.noTeam && (
            <p className="rounded-md border border-dashed border-danger/40 bg-red-50 px-4 py-8 text-center text-sm text-danger">
              <T s="Your account isn't linked to a team yet. Ask the Master to link it in Users." />
            </p>
          )}
          {!profile.noTeam && buildings.length === 0 && (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
              <T s="No building assigned to your account yet." />
            </p>
          )}

          {buildings.map((b: any) => (
            <section key={b.id}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-ink/40">
                    <T s="Team" />
                  </p>
                  <h2 className="font-display text-lg font-bold text-petrol">{b.nome}</h2>
                </div>
                {b.workOrder && <span className="font-mono text-xs text-ink/40">WO {b.workOrder}</span>}
              </div>

              {/* Reordenar e "Sheet labels" (Building/WO por pessoa na folha
                  impressa) ficam liberados aqui — canManageStaff=false continua
                  escondendo horas/editar/excluir/histórico, que são exclusivos
                  do Master (ver comentário em StaffRow). */}
              <BuildingStaffClient
                staff={b.cleaners}
                emptyLabel="No cleaner assigned to this building."
                slots={b.slots}
                buildingId={b.id}
                buildingNome={b.nome}
                buildingWorkOrder={b.workOrder}
                role="cleaner"
                canManageStaff={false}
              />
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
