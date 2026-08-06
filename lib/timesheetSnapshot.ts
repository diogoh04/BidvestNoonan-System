import { prisma } from "./prisma";
import { computeOpenSlots } from "./openSlots";
import {
  getTimesheetDayKeys,
  type TimesheetEntries,
  type TimesheetRow,
  type TimesheetPeriodType,
} from "./types";

function emptyDays(periodType: TimesheetPeriodType): Record<string, { in: string | null; out: string | null }> {
  return Object.fromEntries(getTimesheetDayKeys(periodType).map((d) => [d, { in: null, out: null }]));
}

// Fotografa o estado atual do prédio (cleaners + vagas em aberto + covers)
// em linhas de folha de ponto. Chamado só na criação da folha da semana —
// depois disso a folha vive só do próprio JSON salvo, não é re-derivada.
export async function buildInitialEntries(
  buildingId: bigint,
  periodType: TimesheetPeriodType = "weekly"
): Promise<TimesheetEntries> {
  const [links, slots, covers] = await Promise.all([
    prisma.staffBuilding.findMany({ where: { buildingId, role: "cleaner" }, include: { staff: true } }),
    prisma.buildingSlot.findMany({ where: { buildingId }, orderBy: { ordem: "asc" } }),
    prisma.buildingCover.findMany({ where: { buildingId }, orderBy: { createdAt: "asc" } }),
  ]);

  const cleanerRows: TimesheetRow[] = links.map((l) => ({
    kind: "staff",
    refId: l.staff.id.toString(),
    nome: l.staff.nome,
    staffNumber: l.staff.staffNumber,
    horas: l.horas ?? l.staff.horasSemana,
    days: emptyDays(periodType),
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
    days: emptyDays(periodType),
  }));

  // maior número de horas primeiro, igual buildRows() da tela de impressão
  const frontRows = [...cleanerRows, ...slotRows].sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0));

  const coverRows: TimesheetRow[] = covers.map((c) => ({
    kind: "cover",
    refId: c.id.toString(),
    nome: c.nome,
    staffNumber: c.staffNumber,
    horas: c.horas,
    days: emptyDays(periodType),
  }));

  return { rows: [...frontRows, ...coverRows] };
}

export function emptyTimesheetRow(kind: "cover", periodType: TimesheetPeriodType = "weekly"): TimesheetRow {
  return { kind, refId: null, nome: null, staffNumber: null, horas: null, days: emptyDays(periodType) };
}

// Usado ao criar a folha de uma semana nova a partir da anterior ("copiar
// da semana anterior"): mantém as linhas (staff/vaga/cover) mas zera os
// horários — cada semana lança seu próprio ponto. `periodType` é o da folha
// NOVA (pode diferir do da fonte só em teoria — a UI só oferece copiar entre
// folhas do mesmo tipo, ver LancarClient), então o quadro de dias sai
// sempre com o formato certo pra quem está sendo criada agora.
export function cloneEntriesForNewWeek(
  source: TimesheetEntries,
  periodType: TimesheetPeriodType = "weekly"
): TimesheetEntries {
  return { rows: source.rows.map((r) => ({ ...r, days: emptyDays(periodType) })) };
}
