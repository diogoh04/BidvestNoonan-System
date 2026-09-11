import { Pencil, Trash2 } from "lucide-react";
import { formatWeekRange, formatDDMM, formatDateRange } from "@/lib/week";
import type { AdjustmentReportDTO, AdjustmentItemDTO } from "@/lib/types";

type Editable = { onEdit: (itemId: string) => void; onDelete: (itemId: string) => void };

function staffLabel(it: AdjustmentItemDTO): string {
  const n = it.staffNome ?? "—";
  return it.staffNumber ? `${n} (${it.staffNumber})` : n;
}

// Junta os itens da mesma pessoa num card só (o mesmo staff pode ter vários
// ajustes na semana). Mantém a ordem de entrada.
function groupByStaff(items: AdjustmentItemDTO[]): { label: string; items: AdjustmentItemDTO[] }[] {
  const groups = new Map<string, { label: string; items: AdjustmentItemDTO[] }>();
  for (const it of items) {
    const key = it.staffId ?? `${it.staffNome ?? ""}|${it.staffNumber ?? ""}`;
    if (!groups.has(key)) groups.set(key, { label: staffLabel(it), items: [] });
    groups.get(key)!.items.push(it);
  }
  return [...groups.values()];
}

function timeRange(it: AdjustmentItemDTO): string | null {
  return it.timeFrom && it.timeTo ? `${it.timeFrom} to ${it.timeTo}` : null;
}

type ItemParts = { when: string; primary: string; secondary: string | null; tag: string | null };

// Ação principal + quando + a "2ª ação" (a razão vira `ADD <código>`).
function itemParts(it: AdjustmentItemDTO): ItemParts {
  const t = timeRange(it);
  const reason = it.reasonCode ? `ADD ${it.reasonCode}` : null;

  if (it.action === "add_hours") {
    return {
      when: formatDateRange(it.dateFrom, it.dateTo),
      primary: t ? `ADD ${t}` : "ADD",
      secondary: null,
      tag: it.isCover ? "cover" : null,
    };
  }
  if (it.action === "remove_hours") {
    return {
      when: formatDateRange(it.dateFrom, it.dateTo),
      primary: t ? `REMOVE ${t}` : "REMOVE",
      secondary: reason,
      tag: null,
    };
  }
  if (it.action === "remove_from_building") {
    return { when: `from ${formatDDMM(it.dateFrom)}`, primary: "REMOVE FROM BUILDING", secondary: reason, tag: null };
  }
  return { when: `from ${formatDDMM(it.dateFrom)}`, primary: "ADD TO BUILDING", secondary: null, tag: null };
}

// Render compartilhado: prévia do TL, leitura do TL e revisão do supervisor.
// `editable` (só no rascunho do TL) mostra lápis + lixeira por item.
export default function AdjustmentReportView({
  report,
  editable,
}: {
  report: AdjustmentReportDTO;
  editable?: Editable;
}) {
  const buildings = report.groups.map((g) => g.buildingNome).join(" and ");

  return (
    <div className="rounded-md border border-line bg-white p-4 text-sm sm:p-5">
      <div className="font-display text-base font-bold text-ink">
        Adjustments {formatWeekRange(report.weekStart)}
        {buildings ? ` — ${buildings}` : ""}
      </div>

      {report.groups.length === 0 && <p className="mt-3 text-ink/40">No items yet.</p>}

      {report.groups.map((g) => (
        <div key={g.buildingId} className="mt-4 border-t border-line pt-3 first:mt-3">
          <div className="font-bold uppercase text-ink">
            {g.buildingNome}
            {g.buildingWorkOrder ? `  ·  WO - ${g.buildingWorkOrder}` : ""}
          </div>

          <div className="mt-2 space-y-2">
            {groupByStaff(g.items).map((sg, i) => (
              <div key={i} className="rounded-md border border-line/70 bg-surface/40 px-3 py-2">
                <div className="font-medium text-ink">{sg.label}</div>
                <div className="mt-1 space-y-1">
                  {sg.items.map((it) => {
                    const p = itemParts(it);
                    return (
                      <div key={it.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink/80">
                        <span className="font-mono text-xs text-ink/50">{p.when}</span>
                        <span className="rounded bg-white px-1.5 py-0.5 font-medium text-ink">{p.primary}</span>
                        {p.secondary && (
                          <span className="rounded bg-white px-1.5 py-0.5 font-medium text-ink">{p.secondary}</span>
                        )}
                        {p.tag && <span className="text-ink/40">({p.tag})</span>}
                        {it.note && <span className="text-xs text-ink/40">— {it.note}</span>}
                        {editable && (
                          <span className="ml-auto flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => editable.onEdit(it.id)}
                              title="Edit"
                              className="rounded-md p-2 text-ink/40 hover:bg-petrolLight hover:text-petrol"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => editable.onDelete(it.id)}
                              title="Delete"
                              className="rounded-md p-2 text-ink/40 hover:bg-red-50 hover:text-danger"
                            >
                              <Trash2 size={14} />
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
