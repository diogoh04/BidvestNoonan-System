import Header from "@/components/Header";
import LancarClient from "./LancarClient";

export default function LancarTimesheetsPage({ searchParams }: { searchParams: { week?: string } }) {
  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-6xl px-6 py-10 print:max-w-none print:px-4 print:py-2">
        <div className="print:hidden">
          <h1 className="font-display text-2xl font-bold text-ink">Lançar folha de ponto</h1>
          <p className="mt-1 text-sm text-ink/50">
            Todos os seus prédios juntos, na mesma semana — igual a folha que seria impressa.
          </p>
        </div>
        <div className="mt-6 print:mt-0">
          <LancarClient initialWeek={searchParams.week ?? null} />
        </div>
      </main>
    </>
  );
}
