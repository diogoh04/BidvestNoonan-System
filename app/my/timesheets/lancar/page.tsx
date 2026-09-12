import Header from "@/components/Header";
import T from "@/components/T";
import LancarClient from "./LancarClient";

export default function LancarTimesheetsPage({
  searchParams,
}: {
  searchParams: { week?: string; new?: string };
}) {
  return (
    <>
      <Header role="team_leader" />
      <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10 print:max-w-none print:px-4 print:py-2">
        <div className="print:hidden">
          <h1 className="font-display text-2xl font-bold text-ink">
            <T s="Log timesheet" />
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            <T s="All your buildings together, in one fortnight — same as the sheet that would be printed." />
          </p>
        </div>
        <div className="mt-6 print:mt-0">
          <LancarClient initialWeek={searchParams.week ?? null} forceNew={searchParams.new === "1"} />
        </div>
      </main>
    </>
  );
}
