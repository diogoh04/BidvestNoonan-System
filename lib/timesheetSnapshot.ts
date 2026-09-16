import { prisma } from "./prisma";
import { computeOpenSlots } from "./openSlots";
import { orderSheetRows } from "./timesheetRows";
import {
  getTimesheetDates,
  type TimesheetEntries,
  type TimesheetRow,
  type TimesheetPeriodType,
} from "./types";

// `weekStart`/`weekEnd` só vêm preenchidos nas folhas novas de duração
// livre (ver /my/timesheets/lancar) — aí as chaves de `days` já saem como a
// data ISO real de cada dia útil, em vez do símbolo fixo de sempre
// (getTimesheetDates cai de volta pro comportamento legado sem weekEnd).
function emptyDays(
  periodType: TimesheetPeriodType,
  weekStart?: string | null,
  weekEnd?: string | null
): Record<string, { in: string | null; out: string | null }> {
  const keys = getTimesheetDates(weekStart ?? "", weekEnd ?? null, periodType);
  return Object.fromEntries(keys.map((d) => [d, { in: null, out: null }]));
}

// Fotografa o estado atual do prédio (cleaners + vagas em aberto + covers)
// em linhas de folha de ponto. Chamado só na criação da folha da semana —
// depois disso a folha vive só do próprio JSON salvo, não é re-derivada.
export async function buildInitialEntries(
  buildingId: bigint,
  periodType: TimesheetPeriodType = "weekly",
  weekStart?: string | null,
  weekEnd?: string | null
): Promise<TimesheetEntries> {
  const [links, slots, covers] = await Promise.all([
    prisma.staffBuilding.findMany({
      where: { buildingId, role: "cleaner" },
      include: { staff: true },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
    }),
    prisma.buildingSlot.findMany({ where: { buildingId }, orderBy: { ordem: "asc" } }),
    prisma.buildingCover.findMany({ where: { buildingId }, orderBy: { createdAt: "asc" } }),
  ]);

  // `ordem` só influencia a ordenação (ver lib/timesheetRows.ts) — não vai
  // pro JSON de entries.
  const cleanerRows: (TimesheetRow & { ordem?: number | null })[] = links.map((l) => ({
    kind: "staff",
    refId: l.staff.id.toString(),
    nome: l.staff.nome,
    staffNumber: l.staff.staffNumber,
    horas: l.horas ?? l.staff.horasSemana,
    days: emptyDays(periodType, weekStart, weekEnd),
    ordem: l.ordem,
    predioLabel: l.predioLabel,
    workOrder: l.workOrder,
  }));

  const staffForSlots = links.map((l) => ({ horasSemana: l.horas ?? l.staff.horasSemana }));
  const openSlots = computeOpenSlots(
    slots.map((s) => ({ id: s.id.toString(), horas: s.horas })),
    staffForSlots
  );
  const slotRows: TimesheetRow[] = openSlots.map((s) => ({
    kind: "openSlot",
    refId: s.id,
    nome: null,
    staffNumber: null,
    horas: s.horas,
    days: emptyDays(periodType, weekStart, weekEnd),
  }));

  // Ordem automática (por horas) ou manual — mesma regra da folha de impressão.
  // `ordem` é só pra ordenar; tira do objeto antes de virar linha do snapshot.
  const frontRows: TimesheetRow[] = orderSheetRows(cleanerRows, slotRows).map((row) => {
    const { ordem: _ordem, ...rest } = row as TimesheetRow & { ordem?: number | null };
    return rest;
  });

  const coverRows: TimesheetRow[] = covers.map((c) => ({
    kind: "cover",
    refId: c.id.toString(),
    nome: c.nome,
    staffNumber: c.staffNumber,
    horas: c.horas,
    days: emptyDays(periodType, weekStart, weekEnd),
  }));

  return { rows: [...frontRows, ...coverRows] };
}

export function emptyTimesheetRow(
  kind: "cover",
  periodType: TimesheetPeriodType = "weekly",
  weekStart?: string | null,
  weekEnd?: string | null
): TimesheetRow {
  return { kind, refId: null, nome: null, staffNumber: null, horas: null, days: emptyDays(periodType, weekStart, weekEnd) };
}

// Usado ao criar a folha de uma semana nova a partir da anterior ("copiar
// da semana anterior"): mantém as linhas (staff/vaga/cover) mas zera os
// horários — cada semana lança seu próprio ponto. `periodType`/`weekStart`/
// `weekEnd` são os da folha NOVA (pode diferir da fonte só em teoria — a UI
// só oferece copiar entre folhas do mesmo tipo, ver LancarClient), então o
// quadro de dias sai sempre com o formato certo pra quem está sendo criada
// agora.
export function cloneEntriesForNewWeek(
  source: TimesheetEntries,
  periodType: TimesheetPeriodType = "weekly",
  weekStart?: string | null,
  weekEnd?: string | null
): TimesheetEntries {
  return { rows: source.rows.map((r) => ({ ...r, days: emptyDays(periodType, weekStart, weekEnd) })) };
}

// Usado só no "Launch" de uma quinzenal (POST /api/timesheets/fortnight/launch):
// separa o entries de 10 colunas (W1_*/W2_*, ver TIMESHEET_DAYS_BIWEEKLY em
// lib/types.ts) em duas TimesheetEntries semanais de 5 colunas, preservando
// linhas/ordem/identidade (kind/refId/nome/staffNumber/horas) — só o mapa
// `days` de cada linha muda, virando as chaves normais (MONDAY..FRIDAY) sem
// o prefixo W1_/W2_.
export function splitFortnightEntries(source: TimesheetEntries): {
  week1: TimesheetEntries;
  week2: TimesheetEntries;
} {
  const pick = (prefix: "W1_" | "W2_"): TimesheetEntries => ({
    rows: source.rows.map((r) => ({
      ...r,
      days: Object.fromEntries(
        Object.entries(r.days)
          .filter(([k]) => k.startsWith(prefix))
          .map(([k, v]) => [k.slice(3), v])
      ),
    })),
  });
  return { week1: pick("W1_"), week2: pick("W2_") };
}
