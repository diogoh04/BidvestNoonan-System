"use client";

import Image from "next/image";
import { Printer } from "lucide-react";

type StaffLine = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  horasSemana: number | null;
};

type Slot = { id: string; horas: number };

type BuildingSection = {
  id: string;
  nome: string;
  workOrder: string | null;
  slots: Slot[];
  cleaners: StaffLine[];
};

type TeamLeader = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  buildings: BuildingSection[];
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
const ESTATES_EVENTS_WO = "515736";

function buildRows(staff: StaffLine[], slots: Slot[]) {
  const total = Math.max(staff.length, slots.length);
  const rows: { nome: string | null; staffNumber: string | null; horas: number | null }[] = [];
  for (let i = 0; i < total; i++) {
    const s = staff[i];
    const slot = slots[i];
    rows.push({
      nome: s?.nome ?? null,
      staffNumber: s?.staffNumber ?? null,
      horas: s?.horasSemana ?? slot?.horas ?? null,
    });
  }
  // maior número de horas primeiro
  rows.sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0));
  return rows;
}

function BlankRow({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <tr key={"blank-" + i}>
          <td className="border border-ink p-1 h-8"></td>
          <td className="border border-ink p-1"></td>
          <td className="border border-ink p-1"></td>
          <td className="border border-ink p-1"></td>
          <td className="border border-ink p-1"></td>
          {DAYS.map((d) => (
            <>
              <td key={d + i + "-in"} className="border border-ink p-1"></td>
              <td key={d + i + "-out"} className="border border-ink p-1"></td>
            </>
          ))}
        </tr>
      ))}
    </>
  );
}

function frontTableSizing(rowCount: number) {
  if (rowCount <= 10) return { text: "text-xs", pad: "p-1", cellH: "h-8" };
  if (rowCount <= 16) return { text: "text-[10px]", pad: "p-0.5", cellH: "h-6" };
  if (rowCount <= 24) return { text: "text-[9px]", pad: "p-0.5", cellH: "h-5" };
  return { text: "text-[8px]", pad: "p-[2px]", cellH: "h-4" };
}

export default function LeaderTimesheetView({ teamLeader }: { teamLeader: TeamLeader }) {
  const coverItems = teamLeader.buildings.map((b) => `${b.nome} - WO ${b.workOrder ?? "—"}`);
  const totalFrontRows = teamLeader.buildings.reduce(
    (sum, b) => sum + Math.max(b.cleaners.length, b.slots.length, 1),
    0
  );
  const grandTotalHours = teamLeader.buildings.reduce((sum, b) => {
    const rows = buildRows(b.cleaners, b.slots);
    return sum + rows.reduce((s, r) => s + (r.horas ?? 0), 0);
  }, 0);
  const sz = frontTableSizing(totalFrontRows);
  const cell = `border border-ink ${sz.pad}`;
  const signCell = `border border-ink ${sz.pad} ${sz.cellH}`;

  return (
    <main className="mx-auto max-w-6xl bg-white px-6 py-10 print:max-w-none print:px-8 print:py-4">
      <div className="mb-6 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-md bg-petrol px-4 py-2 text-sm font-medium text-white hover:bg-petrolDark"
        >
          <Printer size={16} />
          Imprimir / Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6 border-b-2 border-ink pb-3">
        <Image src="/logo.jpg" alt="Bidvest Noonan" width={160} height={50} className="h-10 w-auto object-contain" />
        <h1 className="text-center font-display text-xl font-bold uppercase tracking-wide text-ink">
          Sign In &amp; Sign Out Book
        </h1>
        <div className="flex items-center gap-6">
          <span className="font-display text-lg font-bold text-ink">
            {teamLeader.buildings.map((b) => b.nome).join(", ")}
          </span>
          <Image src="/logoUCD.png" alt="Logo do cliente" width={56} height={56} className="h-14 w-14 shrink-0 object-contain" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">WEEK</span>
          <span className="inline-block w-16 border-b border-ink">&nbsp;</span>
          <span>/</span>
          <span className="inline-block w-16 border-b border-ink">&nbsp;</span>
          <span>—</span>
          <span className="inline-block w-16 border-b border-ink">&nbsp;</span>
          <span>/</span>
          <span className="inline-block w-16 border-b border-ink">&nbsp;</span>
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
          <span><strong>HP</strong> - Holiday Paid</span>
          <span><strong>AA</strong> - Absent Autorized</span>
          <span><strong>S</strong> - Sick</span>
          <span><strong>HU</strong> - Holiday Unpaid</span>
          <span><strong>AU</strong> - Absent Unautorized</span>
          <span><strong>BH</strong> - Bank Holiday</span>
          <span className="col-span-3"><strong>P45</strong> - Leaving</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="font-medium text-ink">Team Leader</span>
        <span className="inline-block min-w-[220px] border-b border-ink px-2">
          {teamLeader.nome}
        </span>
      </div>

      <table className={`mt-6 w-full border-collapse ${sz.text}`}>
        <thead>
          <tr>
            <th rowSpan={2} className={`${cell} align-middle`}>Building</th>
            <th rowSpan={2} className={`${cell} align-middle`}>{grandTotalHours}h total</th>
            <th rowSpan={2} className={`${cell} align-middle`}>WO</th>
            <th rowSpan={2} className={`${cell} align-middle`}>Name</th>
            <th rowSpan={2} className={`${cell} align-middle`}>Staff Number</th>
            {DAYS.map((d) => (
              <th key={d} colSpan={2} className={`${cell} text-center`}>
                {d}
              </th>
            ))}
          </tr>
          <tr>
            {DAYS.map((d) => (
              <>
                <th key={d + "-in"} className={`${cell} text-center font-normal`}>SIGN IN</th>
                <th key={d + "-out"} className={`${cell} text-center font-normal`}>SIGN OUT</th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={15} className="h-3 border-0"></td>
          </tr>
          {teamLeader.buildings.length === 0 && (
            <tr>
              <td colSpan={15} className={`${cell} text-center text-ink/40`}>
                Nenhum prédio vinculado a este team leader.
              </td>
            </tr>
          )}
          {teamLeader.buildings.map((b, buildingIndex) => {
            const rows = buildRows(b.cleaners, b.slots);
            const spacerRow =
              buildingIndex > 0 ? (
                <tr key={b.id + "-spacer"}>
                  <td colSpan={15} className="h-3 border-0"></td>
                </tr>
              ) : null;

            if (rows.length === 0) {
              return (
                <>
                  {spacerRow}
                  <tr key={b.id}>
                    <td className={`${cell} text-center font-medium`}>{b.nome}</td>
                    <td className={cell}></td>
                    <td className={`${cell} text-center`}>{b.workOrder ?? ""}</td>
                    <td className={`${cell} text-ink/30`} colSpan={2}>
                      sem cleaner ou vaga cadastrada
                    </td>
                    {DAYS.map((d) => (
                      <>
                        <td key={d + b.id + "-in"} className={signCell}></td>
                        <td key={d + b.id + "-out"} className={signCell}></td>
                      </>
                    ))}
                  </tr>
                </>
              );
            }

            return (
              <>
                {spacerRow}
                {rows.map((r, i) => (
                  <tr key={b.id + i}>
                    {i === 0 && (
                      <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                        {b.nome}
                      </td>
                    )}
                    <td className={`${cell} text-center`}>{r.horas ?? ""}</td>
                    {i === 0 && (
                      <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                        {b.workOrder ?? ""}
                      </td>
                    )}
                    <td className={cell}>{r.nome ?? ""}</td>
                    <td className={`${cell} text-center`}>{r.staffNumber ?? ""}</td>
                    {DAYS.map((d) => (
                      <>
                        <td key={d + b.id + i + "-in"} className={signCell}></td>
                        <td key={d + b.id + i + "-out"} className={signCell}></td>
                      </>
                    ))}
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>

      <div className="mt-10 break-before-page">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-ink p-1 align-middle">Building Covers</th>
              <th rowSpan={2} className="border border-ink p-1 align-middle">Hours</th>
              <th rowSpan={2} className="border border-ink p-1 align-middle">WO</th>
              <th rowSpan={2} className="border border-ink p-1 align-middle">Name</th>
              <th rowSpan={2} className="border border-ink p-1 align-middle">Staff Number</th>
              {DAYS.map((d) => (
                <th key={d} colSpan={2} className="border border-ink p-1 text-center">
                  {d}
                </th>
              ))}
            </tr>
            <tr>
              {DAYS.map((d) => (
                <>
                  <th key={d + "-in2"} className="border border-ink p-1 text-center font-normal">SIGN IN</th>
                  <th key={d + "-out2"} className="border border-ink p-1 text-center font-normal">SIGN OUT</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            <BlankRow n={7} />

            <tr>
              <td className="border border-ink p-1 font-medium">ESTATES ADDITIONAL</td>
              <td className="border border-ink p-1"></td>
              {(() => {
                const total = 13;
                const per = Math.floor(total / coverItems.length);
                return coverItems.map((item, idx) => (
                  <td
                    key={idx}
                    colSpan={idx === coverItems.length - 1 ? total - per * (coverItems.length - 1) : per}
                    className="border border-ink p-1 text-center font-medium"
                  >
                    {item}
                  </td>
                ));
              })()}
            </tr>

            <BlankRow n={6} />

            <tr>
              <td className="border border-ink p-1 font-medium">ESTATES EVENTS</td>
              <td className="border border-ink p-1"></td>
              <td className="border border-ink p-1 text-center font-medium">{ESTATES_EVENTS_WO}</td>
              <td className="border border-ink p-1"></td>
              <td className="border border-ink p-1"></td>
              {DAYS.map((d) => (
                <>
                  <td key={d + "-events-in"} className="border border-ink p-1"></td>
                  <td key={d + "-events-out"} className="border border-ink p-1"></td>
                </>
              ))}
            </tr>

            <BlankRow n={4} />
          </tbody>
        </table>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          .break-before-page {
            break-before: page;
          }
        }
      `}</style>
    </main>
  );
}
