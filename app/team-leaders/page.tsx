import Link from "next/link";
import { headers } from "next/headers";
import Header from "@/components/Header";
import { Building2, ChevronRight } from "lucide-react";

async function getBaseUrl() {
  const h = headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getTeamLeaders() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/team-leaders`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function TeamLeadersPage() {
  const teamLeaders = await getTeamLeaders();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Team Leaders</h1>
        <p className="mt-1 text-sm text-ink/50">
          {teamLeaders.length} cadastrado(s). Clique para ver os prédios e o staff.
        </p>

        <div className="mt-6 space-y-2">
          {teamLeaders.length === 0 && (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-ink/50">
              Nenhum team leader cadastrado ainda.
            </p>
          )}

          {teamLeaders.map((tl: any) => (
            <Link
              key={tl.id}
              href={`/team-leaders/${tl.id}`}
              className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3 transition hover:border-petrol"
            >
              <div>
                <div className="font-medium text-ink">{tl.nome}</div>
                <div className="mt-0.5 flex items-center gap-x-3 font-mono text-xs text-ink/50">
                  <span>#{tl.staffNumber || "s/n"}</span>
                  <span className="flex items-center gap-1 text-petrol">
                    <Building2 size={12} />
                    {tl.buildings.length} prédio(s)
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink/30" />
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
