"use client";

// Precisa ser Client Component: o botão "copiar" usa useState (feedback de
// "copiado") e navigator.clipboard, e os itens já editáveis usam onClick —
// nenhum dos dois roda num Server Component. É renderizado tanto por um pai
// client (AdjustmentReportEditorClient) quanto direto por uma página server
// (app/review/adjustments/[id]/page.tsx, sem `editable`) — nesse segundo
// caso ele só vira uma fronteira client normal, sem problema.
import { useState } from "react";
import { Pencil, Trash2, Copy, Check } from "lucide-react";
import { formatWeekRange, formatDDMM, allDaysInRange } from "@/lib/week";
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

// Uma linha exibida na tela — igual um AdjustmentItemDTO, exceto que
// "de X até Y" (dateFrom/dateTo diferentes) agora vira uma linha POR DIA
// corrido (não pula fim de semana — ver allDaysInRange), em vez de uma linha
// só com "14/09 to 16/09". `itemId` continua apontando pro item de verdade
// no banco: editar/apagar qualquer linha de um intervalo edita/apaga o
// intervalo inteiro (não dá pra editar só "uma das linhas" — a divisão é só
// visual, o item salvo continua sendo um range só).
type DisplayRow = { key: string; itemId: string; when: string; primary: string; secondary: string | null; tag: string | null; note: string | null };

function itemRows(it: AdjustmentItemDTO): DisplayRow[] {
  const t = timeRange(it);
  const reason = it.reasonCode ? `ADD ${it.reasonCode}` : null;
  const note = it.note ?? null;

  if (it.action === "add_hours" || it.action === "remove_hours") {
    const primary = it.action === "add_hours" ? (t ? `ADD ${t}` : "ADD") : t ? `REMOVE ${t}` : "REMOVE";
    const secondary = it.action === "remove_hours" ? reason : null;
    const tag = it.action === "add_hours" && it.isCover ? "cover" : null;
    return allDaysInRange(it.dateFrom, it.dateTo).map((d) => ({
      key: `${it.id}:${d}`,
      itemId: it.id,
      when: formatDDMM(d),
      primary,
      secondary,
      tag,
      note,
    }));
  }

  const primary = it.action === "remove_from_building" ? "REMOVE FROM BUILDING" : "ADD TO BUILDING";
  const secondary = it.action === "remove_from_building" ? reason : null;
  return [{ key: it.id, itemId: it.id, when: `from ${formatDDMM(it.dateFrom)}`, primary, secondary, tag: null, note }];
}

// Texto do botão "copiar" (um só, no topo do card inteiro) — título
// (Adjustments + semana + prédios), depois cada prédio com seus funcionários
// e uma linha por dia com hora + motivo (ex.: "REMOVE 06:00 to 10:00 ADD HP")
// quando o item tiver um (reasonCode) — sem isso a remoção fica sem
// explicação pra quem lê a mensagem. Sem nota livre, por escolha do usuário.
function reportToText(report: AdjustmentReportDTO): string {
  const buildings = report.groups.map((g) => g.buildingNome).join(" and ");
  const lines: string[] = [`Adjustments ${formatWeekRange(report.weekStart)}${buildings ? ` — ${buildings}` : ""}`];

  for (const g of report.groups) {
    lines.push("");
    lines.push(`${g.buildingNome}${g.buildingWorkOrder ? ` · WO - ${g.buildingWorkOrder}` : ""}`);
    groupByStaff(g.items).forEach((sg, i) => {
      if (i > 0) lines.push(""); // linha em branco entre um staff e outro
      lines.push(sg.label);
      for (const row of sg.items.flatMap(itemRows)) {
        lines.push(`${row.when}: ${row.primary}${row.secondary ? ` ${row.secondary}` : ""}`);
      }
    });
  }

  return lines.join("\n");
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
      <div className="flex items-start justify-between gap-2">
        <div className="font-display text-base font-bold text-ink">
          Adjustments {formatWeekRange(report.weekStart)}
          {buildings ? ` — ${buildings}` : ""}
        </div>
        {report.groups.length > 0 && <CopyCardButton text={reportToText(report)} />}
      </div>

      {report.groups.length === 0 && <p className="mt-3 text-ink/40">No items yet.</p>}

      {report.groups.map((g) => (
        <div key={g.buildingId} className="mt-4 border-t border-line pt-3 first:mt-3">
          <div className="font-bold uppercase text-ink">
            {g.buildingNome}
            {g.buildingWorkOrder ? `  ·  WO - ${g.buildingWorkOrder}` : ""}
          </div>

          <div className="mt-2 space-y-2">
            {groupByStaff(g.items).map((sg, i) => {
              // Marca só a 1ª linha de cada item com showActions — um range
              // de vários dias vira várias linhas (itemRows), mas continua
              // sendo UM item só pra editar/apagar (não faz sentido repetir
              // lápis/lixeira em cada dia do mesmo range).
              const rows = sg.items.flatMap((it) => itemRows(it).map((row, idx) => ({ ...row, showActions: idx === 0 })));
              return (
                <div key={i} className="rounded-md border border-line/70 bg-surface/40 px-3 py-2">
                  <div className="font-medium text-ink">{sg.label}</div>
                  <div className="mt-1 space-y-1">
                    {rows.map((row) => (
                      <div key={row.key} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink/80">
                        <span className="font-mono text-xs text-ink/50">{row.when}</span>
                        <span className="rounded bg-white px-1.5 py-0.5 font-medium text-ink">{row.primary}</span>
                        {row.secondary && (
                          <span className="rounded bg-white px-1.5 py-0.5 font-medium text-ink">{row.secondary}</span>
                        )}
                        {row.tag && <span className="text-ink/40">({row.tag})</span>}
                        {row.note && <span className="text-xs text-ink/40">— {row.note}</span>}
                        {editable && row.showActions && (
                          <span className="ml-auto flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => editable.onEdit(row.itemId)}
                              title="Edit"
                              className="rounded-md p-2 text-ink/40 hover:bg-petrolLight hover:text-petrol"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => editable.onDelete(row.itemId)}
                              title="Delete"
                              className="rounded-md p-2 text-ink/40 hover:bg-red-50 hover:text-danger"
                            >
                              <Trash2 size={14} />
                            </button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Botão "copiar card" — texto simples pronto pra colar numa mensagem (ex.:
// WhatsApp). Feedback de 2s (ícone vira check) em vez de alert/toast, pra
// não precisar de mais infra só pra isso.
function CopyCardButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de clipboard (raro) — sem feedback, sem quebrar a tela.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy"
      className="flex shrink-0 items-center gap-1 rounded-md p-1.5 text-ink/40 hover:bg-petrolLight hover:text-petrol"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}
