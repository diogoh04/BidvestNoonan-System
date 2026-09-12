import { computeOpenSlots, type Slot } from "./openSlots";

// Ordenação dos nomes na folha de ponto (Sign In & Sign Out Book).
//
// Regra, compartilhada pelas 3 telas que montam a folha
// (app/timesheets/[id]/TimesheetView, app/timesheets/leader/[id]/LeaderTimesheetView
// e lib/timesheetSnapshot.ts:buildInitialEntries) e pela página do prédio
// (components/BuildingStaffClient, que mostra a mesma sequência):
//
//   - AUTOMÁTICO (padrão): nenhum cleaner do prédio tem `ordem` definida —
//     cleaners + vagas em aberto entram numa lista só, ordenada por horas
//     (maior primeiro). É o comportamento histórico, intocado.
//
//   - MANUAL: algum cleaner tem `ordem` (o Master reordenou na página do
//     prédio, ver StaffBuilding.ordem / PUT /api/buildings/[id]/staff/order) —
//     cleaners saem na ordem manual (`ordem` asc, nulls no fim, tie-break
//     estável pela posição original) e as vagas em aberto vêm depois, por
//     horas desc.
//
// Módulo puro (só depende de ./openSlots) — pode ser importado tanto no
// servidor quanto num client component.

const ORDEM_MAX = Number.MAX_SAFE_INTEGER;

export function hasManualOrder(cleaners: { ordem?: number | null }[]): boolean {
  return cleaners.some((c) => c.ordem != null);
}

// Ordena só a lista de cleaners conforme o modo (sem mexer em vagas).
// `horasOf` extrai a carga horária do item (default: campo `horas`); a página
// do prédio passa um getter pro campo `horasSemana`.
export function orderCleaners<T extends { ordem?: number | null }>(
  cleaners: T[],
  horasOf: (c: T) => number | null = (c) => (c as { horas?: number | null }).horas ?? null
): T[] {
  const indexed = cleaners.map((c, i) => ({ c, i }));
  if (hasManualOrder(cleaners)) {
    indexed.sort((a, b) => (a.c.ordem ?? ORDEM_MAX) - (b.c.ordem ?? ORDEM_MAX) || a.i - b.i);
  } else {
    indexed.sort((a, b) => (horasOf(b.c) ?? 0) - (horasOf(a.c) ?? 0) || a.i - b.i);
  }
  return indexed.map((x) => x.c);
}

// Junta cleaners + vagas em aberto na ordem final da folha. Genérico no tipo
// da linha (as telas ao vivo passam { nome, staffNumber, horas }; o snapshot
// passa linhas TimesheetRow com `days`/`kind`) — só precisa de `horas` pra
// ordenar, e `ordem` nas linhas de cleaner.
export function orderSheetRows<T extends { horas: number | null }>(
  cleanerRows: (T & { ordem?: number | null })[],
  slotRows: T[]
): T[] {
  if (!hasManualOrder(cleanerRows)) {
    return [...cleanerRows, ...slotRows].sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0));
  }
  const ordered = orderCleaners(cleanerRows);
  const slots = [...slotRows].sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0));
  return [...ordered, ...slots];
}

// Atalho pras duas folhas ao vivo, que partem de uma lista de cleaners
// { nome, staffNumber, horas, ordem, ... } + as vagas do prédio.
export type SheetCleaner = {
  nome: string | null;
  staffNumber: string | null;
  horas: number | null;
  ordem?: number | null;
  // id do vínculo StaffBuilding — pra editar Building/WO ligado à pessoa.
  sbId?: string | null;
  // Building/WO próprios desta linha (ver StaffBuilding.predioLabel/workOrder).
  // Vazio/null = usa o do prédio.
  predioLabel?: string | null;
  workOrder?: string | null;
};

export type SheetRow = {
  kind: "staff" | "openSlot";
  nome: string | null;
  staffNumber: string | null;
  horas: number | null;
  // id do vínculo (só linha de staff) — null na vaga em aberto.
  sbId: string | null;
  // Building/WO JÁ RESOLVIDOS (rótulo próprio ou o do prédio).
  predio: string | null;
  wo: string | null;
};

// Resincroniza só a ORDEM das linhas "staff" de uma folha (entries.rows) com
// um reorder feito depois dela ter sido criada — sem tocar em horas
// lançadas, covers ou vagas em aberto (essas mantêm a posição de índice que
// já tinham). Chamado só pelo PUT /api/buildings/[id]/staff/order, e só em
// timesheets ainda "draft" (submitted/done continuam congeladas de vez,
// ver lib/timesheetSnapshot.ts). `staffIdOrder` é staffId -> posição pra
// ordem manual; `null` volta ao automático (por horas, maior primeiro) —
// mesma regra do orderCleaners. Casamento é por `refId` (Staff.id) — se o
// mesmo staff tiver dois vínculos no mesmo prédio (dois turnos), as duas
// linhas empatam nessa mesma posição (limitação do formato, raro na prática).
export function reorderTimesheetRows<T extends { kind: string; refId: string | null; horas: number | null }>(
  rows: T[],
  staffIdOrder: Map<string, number> | null
): T[] {
  const staffIndices = rows.reduce<number[]>((acc, r, i) => {
    if (r.kind === "staff") acc.push(i);
    return acc;
  }, []);
  if (staffIndices.length < 2) return rows;

  const staffRows = staffIndices.map((i) => rows[i]);
  const sorted = [...staffRows].sort((a, b) => {
    if (staffIdOrder) {
      const oa = a.refId != null ? staffIdOrder.get(a.refId) : undefined;
      const ob = b.refId != null ? staffIdOrder.get(b.refId) : undefined;
      if (oa == null && ob == null) return 0;
      if (oa == null) return 1;
      if (ob == null) return -1;
      return oa - ob;
    }
    return (b.horas ?? 0) - (a.horas ?? 0);
  });

  const next = [...rows];
  staffIndices.forEach((idx, k) => {
    next[idx] = sorted[k];
  });
  return next;
}

export function buildSheetRows(
  cleaners: SheetCleaner[],
  slots: Slot[],
  building: { nome: string | null; workOrder: string | null }
): SheetRow[] {
  const openSlots = computeOpenSlots(
    slots,
    cleaners.map((c) => ({ horasSemana: c.horas }))
  );

  const cleanerRows = cleaners.map((c) => ({
    kind: "staff" as const,
    nome: c.nome,
    staffNumber: c.staffNumber,
    horas: c.horas,
    ordem: c.ordem,
    sbId: c.sbId ?? null,
    predio: c.predioLabel?.trim() || building.nome,
    wo: c.workOrder?.trim() || building.workOrder,
  }));

  const slotRows: SheetRow[] = openSlots.map((s) => ({
    kind: "openSlot" as const,
    nome: null,
    staffNumber: null,
    horas: s.horas,
    sbId: null,
    predio: building.nome,
    wo: building.workOrder,
  }));

  return orderSheetRows(cleanerRows, slotRows).map(({ kind, nome, staffNumber, horas, sbId, predio, wo }) => ({
    kind,
    nome,
    staffNumber,
    horas,
    sbId,
    predio,
    wo,
  }));
}
