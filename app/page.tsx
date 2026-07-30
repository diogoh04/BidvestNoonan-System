import Link from "next/link";
import { Users, Building2, ClipboardList, Archive, LayoutDashboard } from "lucide-react";
import Header from "@/components/Header";

export default function DashboardPage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col items-center justify-center px-6 py-24">
        <p className="mb-10 font-mono text-xs uppercase tracking-[0.3em] text-ink/40">
          Selecione uma visão
        </p>
        <div className="grid w-full max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            href="/team-leaders"
            className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
          >
            <Users size={40} className="text-petrol" />
            <div>
              <div className="font-display text-2xl font-bold text-ink">Team Leader</div>
              <div className="mt-1 text-sm text-ink/50">
                Ver por líder e os prédios sob sua responsabilidade
              </div>
            </div>
          </Link>

          <Link
            href="/buildings"
            className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
          >
            <Building2 size={40} className="text-petrol" />
            <div>
              <div className="font-display text-2xl font-bold text-ink">Building</div>
              <div className="mt-1 text-sm text-ink/50">
                Ver por prédio e todo o staff alocado nele
              </div>
            </div>
          </Link>

          <Link
            href="/timesheets"
            className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
          >
            <ClipboardList size={40} className="text-petrol" />
            <div>
              <div className="font-display text-2xl font-bold text-ink">
                Sign In &amp; Sign Out Book
              </div>
              <div className="mt-1 text-sm text-ink/50">
                Gerar a folha de ponto de um prédio, pronta pra imprimir
              </div>
            </div>
          </Link>

          <Link
            href="/outros"
            className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
          >
            <Archive size={40} className="text-petrol" />
            <div>
              <div className="font-display text-2xl font-bold text-ink">Outros</div>
              <div className="mt-1 text-sm text-ink/50">P45, LE, Staff Blocked e Sick.</div>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="group flex flex-col items-center gap-4 rounded-md border border-line bg-white px-6 py-10 text-center transition hover:-translate-y-0.5 hover:border-petrol hover:shadow-md"
          >
            <LayoutDashboard size={40} className="text-petrol" />
            <div>
              <div className="font-display text-2xl font-bold text-ink">Dashboard</div>
              <div className="mt-1 text-sm text-ink/50">Visão geral: staff, vagas e horas por prédio</div>
            </div>
          </Link>
        </div>
      </main>
    </>
  );
}
