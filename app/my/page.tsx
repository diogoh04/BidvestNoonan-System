import { headers } from "next/headers";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import Header from "@/components/Header";
import StaffRow from "@/components/StaffRow";

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
  if (!res.ok) return { nome: null, buildings: [] };
  return res.json();
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
            <h1 className="font-display text-2xl font-bold text-ink">Meus Prédios</h1>
            <p className="mt-1 text-sm text-ink/50">
              {buildings.length} prédio(s) sob sua responsabilidade.
            </p>
          </div>
          <Link
            href="/my/timesheets/lancar"
            className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
          >
            <ClipboardList size={16} />
            Lançar folha de ponto
          </Link>
        </div>

        <div className="mt-8 space-y-8">
          {buildings.length === 0 && (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
              Nenhum prédio vinculado à sua conta ainda.
            </p>
          )}

          {buildings.map((b: any) => (
            <section key={b.id}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-bold text-petrol">{b.nome}</h2>
                {b.workOrder && <span className="font-mono text-xs text-ink/40">WO {b.workOrder}</span>}
              </div>

              {b.cleaners.length === 0 ? (
                <p className="text-sm text-ink/40">Nenhum cleaner alocado neste prédio.</p>
              ) : (
                <div className="space-y-2">
                  {b.cleaners.map((s: any) => (
                    <StaffRow
                      key={s.id}
                      id={s.id}
                      nome={s.nome}
                      staffNumber={s.staffNumber}
                      telefone={s.telefone}
                      canManage={false}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
