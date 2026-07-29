"use client";

import { useState } from "react";
import Image from "next/image";
import { Printer, Plus, X } from "lucide-react";
import { computeOpenSlots, type Slot } from "@/lib/openSlots";

type StaffLine = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  horasSemana: number | null;
};

type Cover = { id: string; nome: string | null; staffNumber: string | null; horas: number | null };

type Building = {
  id: string;
  nome: string;
  workOrder: string | null;
  slots: Slot[];
  covers: Cover[];
  teamLeaders: StaffLine[];
  cleaners: StaffLine[];
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
const ESTATES_EVENTS_WO = "515736";
const MIN_COVER_ROWS = 7;

function buildRows(building: Building) {
  const rows: { nome: string | null; staffNumber: string | null; horas: number | null }[] = [
    ...building.teamLeaders.map((t) => ({ nome: t.nome, staffNumber: t.staffNumber, horas: t.horasSemana })),
    ...building.cleaners.map((c) => ({ nome: c.nome, staffNumber: c.staffNumber, horas: c.horasSemana })),
    ...computeOpenSlots(building.slots, building.cleaners).map((s) => ({
      nome: null,
      staffNumber: null,
      horas: s.horas,
    })),
  ];
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

export default function TimesheetView({ building }: { building: Building }) {
  const rows = buildRows(building);
  const coverItems = [`${building.nome} - WO ${building.workOrder ?? "—"}`];
  const totalHours = rows.reduce((sum, r) => sum + (r.horas ?? 0), 0);
  const sz = frontTableSizing(rows.length);
  const cell = `border border-ink ${sz.pad}`;
  const signCell = `border border-ink ${sz.pad} ${sz.cellH}`;

  const [covers, setCovers] = useState<Cover[]>(building.covers);
  const [coverNome, setCoverNome] = useState("");
  const [coverStaffNumber, setCoverStaffNumber] = useState("");
  const [coverHoras, setCoverHoras] = useState("");
  const [savingCover, setSavingCover] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  async function addCover() {
    if (!coverNome.trim()) return;
    setSavingCover(true);
    setCoverError(null);
    try {
      const res = await fetch(`/api/buildings/${building.id}/covers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: coverNome.trim(),
          staffNumber: coverStaffNumber.trim() || null,
          horas: coverHoras.trim() === "" ? null : Number(coverHoras),
        }),
      });
      if (!res.ok) throw new Error("Não foi possível adicionar o cover");
      const created = await res.json();
      setCovers((prev) => [...prev, created]);
      setCoverNome("");
      setCoverStaffNumber("");
      setCoverHoras("");
    } catch (e: any) {
      setCoverError(e.message);
    } finally {
      setSavingCover(false);
    }
  }

  async function removeCover(id: string) {
    setCovers((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/buildings/${building.id}/covers/${id}`, { method: "DELETE" });
    } catch {
    }
  }

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
          <span className="font-display text-lg font-bold text-ink">{building.nome}</span>
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
          {building.teamLeaders.map((t) => t.nome).join(", ") || "\u00A0"}
        </span>
      </div>

      <table className={`mt-6 w-full border-collapse ${sz.text}`}>
        <thead>
          <tr>
            <th rowSpan={2} className={`${cell} align-middle`}>Building</th>
            <th rowSpan={2} className={`${cell} align-middle`}>{totalHours}h total</th>
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
          {rows.length === 0 && (
            <tr>
              <td colSpan={15} className={`${cell} text-center text-ink/40`}>
                Nenhum staff ou vaga cadastrada neste prédio ainda.
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>
              {i === 0 && (
                <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                  {building.nome}
                </td>
              )}
              <td className={`${cell} text-center`}>{r.horas ?? ""}</td>
              {i === 0 && (
                <td rowSpan={rows.length} className={`${cell} text-center font-bold align-middle`}>
                  {building.workOrder ?? ""}
                </td>
              )}
              <td className={cell}>{r.nome ?? ""}</td>
              <td className={`${cell} text-center`}>{r.staffNumber ?? ""}</td>
              {DAYS.map((d) => (
                <>
                  <td key={d + i + "-in"} className={signCell}></td>
                  <td key={d + i + "-out"} className={signCell}></td>
                </>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-10 break-before-page">
        <div className="mb-2 flex flex-wrap items-center gap-2 print:hidden">
          <input
            value={coverNome}
            onChange={(e) => setCoverNome(e.target.value)}
            placeholder="Nome"
            className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
          />
          <input
            value={coverStaffNumber}
            onChange={(e) => setCoverStaffNumber(e.target.value)}
            placeholder="Staff number"
            className="rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
          />
          <input
            type="number"
            min={0}
            value={coverHoras}
            onChange={(e) => setCoverHoras(e.target.value)}
            placeholder="Horas"
            className="w-24 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"
          />
          <button
            type="button"
            onClick={addCover}
            disabled={savingCover}
            className="flex items-center gap-1 rounded-md bg-petrol px-3 py-1.5 text-sm font-medium text-white hover:bg-petrolDark disabled:opacity-50"
          >
            <Plus size={14} />
            Adicionar cover
          </button>
          {coverError && <span className="text-xs text-danger">{coverError}</span>}
        </div>

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
            {covers.map((c) => (
              <tr key={c.id}>
                <td className="border border-ink p-1 h-8"></td>
                <td className="border border-ink p-1 text-center">{c.horas ?? ""}</td>
                <td className="border border-ink p-1"></td>
                <td className="border border-ink p-1">
                  <span className="flex items-center justify-between gap-2">
                    {c.nome ?? ""}
                    <button
                      type="button"
                      onClick={() => removeCover(c.id)}
                      title="Remover cover"
                      className="rounded p-0.5 text-ink/30 hover:text-danger print:hidden"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </td>
                <td className="border border-ink p-1 text-center">{c.staffNumber ?? ""}</td>
                {DAYS.map((d) => (
                  <>
                    <td key={d + c.id + "-in"} className="border border-ink p-1"></td>
                    <td key={d + c.id + "-out"} className="border border-ink p-1"></td>
                  </>
                ))}
              </tr>
            ))}
            <BlankRow n={Math.max(MIN_COVER_ROWS - covers.length, 1)} />

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
