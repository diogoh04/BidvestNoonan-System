"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Clock, Pencil, Check, X, GripVertical, RotateCcw, Tag } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import StaffRow from "@/components/StaffRow";
import StaffHoursCard from "@/components/StaffHoursCard";
import { computeOpenSlots, type Slot } from "@/lib/openSlots";
import { orderCleaners, hasManualOrder } from "@/lib/timesheetRows";

type StaffItem = {
  id: string;
  // id do vínculo StaffBuilding — o mesmo staff pode aparecer mais de uma vez
  // nesta lista (dois turnos/postos no mesmo prédio), então é o `sbId` que
  // identifica a linha pra editar horas / remover / reordenar.
  sbId: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  horasSemana?: number | null;
  // Posição manual na folha (ver lib/timesheetRows.ts). Null em todos = ordem
  // automática por horas.
  ordem?: number | null;
  // Building/WO próprios desta pessoa na folha (ver StaffBuilding). Vazio =
  // usa o do prédio.
  predioLabel?: string | null;
  workOrder?: string | null;
};

// Editor compacto do Building/WO que aparece NA FOLHA pra esta pessoa (ver
// StaffBuilding.predioLabel/workOrder). Vazio = usa o nome/WO do prédio.
function SheetFields({
  item,
  buildingId,
  buildingNome,
  buildingWorkOrder,
  onSaved,
}: {
  item: StaffItem;
  buildingId: string;
  buildingNome?: string;
  buildingWorkOrder?: string | null;
  onSaved: (v: { predioLabel: string | null; workOrder: string | null }) => void;
}) {
  const [predio, setPredio] = useState(item.predioLabel ?? "");
  const [wo, setWo] = useState(item.workOrder ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  function scheduleSave(nextPredio: string, nextWo: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch(`/api/buildings/${buildingId}/staff/sheet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sbId: item.sbId, predioLabel: nextPredio, workOrder: nextWo }),
      }).catch(() => {});
      onSaved({ predioLabel: nextPredio.trim() || null, workOrder: nextWo.trim() || null });
    }, 500);
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-1 text-xs text-ink/40">
      <span className="shrink-0">Sheet</span>
      <input
        value={predio}
        placeholder={buildingNome ?? "Building"}
        onChange={(e) => {
          setPredio(e.target.value);
          scheduleSave(e.target.value, wo);
        }}
        className="w-36 rounded border border-line bg-white px-1.5 py-0.5 text-ink outline-none focus:border-petrol"
      />
      <input
        value={wo}
        placeholder={buildingWorkOrder ?? "WO"}
        onChange={(e) => {
          setWo(e.target.value);
          scheduleSave(predio, e.target.value);
        }}
        className="w-24 rounded border border-line bg-white px-1.5 py-0.5 text-ink outline-none focus:border-petrol"
      />
    </div>
  );
}

// Linha arrastável — só a alça (GripVertical) inicia o drag, então os botões
// de nota/editar/excluir e o campo de horas continuam clicáveis normalmente.
function SortableCleanerRow({
  item,
  position,
  children,
}: {
  item: StaffItem;
  position: number;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.sbId,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: isDragging ? "relative" : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <div className="mt-1 flex shrink-0 flex-col items-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          className="touch-none cursor-grab rounded p-0.5 text-ink/30 transition hover:text-petrol active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <span className="font-mono text-xs text-ink/40">{position}</span>
      </div>
      {children}
    </div>
  );
}

export default function BuildingStaffClient({
  staff,
  emptyLabel,
  slots: initialSlots,
  buildingId,
  buildingNome,
  buildingWorkOrder,
  role,
}: {
  staff: StaffItem[];
  emptyLabel: string;
  slots?: Slot[];
  buildingId?: string;
  buildingNome?: string;
  buildingWorkOrder?: string | null;
  // Papel deste vínculo nesta lista ("cleaner" | "team_leader") — necessário
  // pra editar/remover o vínculo certo quando o staff aparece nas duas
  // listas (cleaner E team leader) do mesmo prédio.
  role?: "cleaner" | "team_leader";
}) {
  const [list, setList] = useState(staff);
  const [slots, setSlots] = useState(initialSlots ?? []);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  // Editor de Building/WO por pessoa na folha — escondido por padrão (é raro),
  // já aberto quando alguém tem rótulo definido.
  const [showSheetFields, setShowSheetFields] = useState(
    staff.some((s) => s.predioLabel || s.workOrder)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Mesma ordenação da folha de ponto: automática (por horas, maior primeiro)
  // enquanto ninguém reordenou; manual (por `ordem`) depois disso.
  const sortedList = orderCleaners(list, (c) => c.horasSemana ?? null);
  const openSlots = initialSlots ? computeOpenSlots(slots, sortedList) : [];

  // Só cleaners num prédio ganham reordenar manual (team leader é no máximo um).
  const canReorder = role === "cleaner" && !!buildingId && sortedList.length > 1;
  const manual = hasManualOrder(list);

  async function persistOrder(nextSorted: StaffItem[]) {
    if (!buildingId) return;
    // Otimista: fixa `ordem` = posição de cada um e mostra na hora.
    setList(nextSorted.map((s, i) => ({ ...s, ordem: i })));
    setSavingOrder(true);
    try {
      await fetch(`/api/buildings/${buildingId}/staff/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sbIds: nextSorted.map((s) => s.sbId) }),
      });
    } catch {
      // best-effort — a ordem local já mudou; um refresh puxa a real do banco
    } finally {
      setSavingOrder(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedList.findIndex((s) => s.sbId === active.id);
    const newIndex = sortedList.findIndex((s) => s.sbId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    persistOrder(arrayMove(sortedList, oldIndex, newIndex));
  }

  async function resetOrder() {
    if (!buildingId) return;
    setList((prev) => prev.map((s) => ({ ...s, ordem: null })));
    setSavingOrder(true);
    try {
      await fetch(`/api/buildings/${buildingId}/staff/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
    } catch {
    } finally {
      setSavingOrder(false);
    }
  }

  async function saveSlotHours(slotId: string) {
    const horas = Number(editValue.replace(",", "."));
    if (!horas || horas <= 0 || !buildingId) {
      setEditingSlotId(null);
      return;
    }
    try {
      const res = await fetch(`/api/buildings/${buildingId}/slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horas }),
      });
      if (!res.ok) throw new Error();
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, horas } : s)));
    } catch {
    } finally {
      setEditingSlotId(null);
    }
  }

  if (list.length === 0 && openSlots.length === 0) {
    return <p className="text-sm text-ink/40">{emptyLabel}</p>;
  }

  const sheetFieldsOn = showSheetFields && role === "cleaner" && !!buildingId;

  const staffRow = (s: StaffItem) => (
    <>
      <div className="flex-1">
        <StaffRow
          id={s.id}
          sbId={s.sbId}
          nome={s.nome}
          staffNumber={s.staffNumber}
          telefone={s.telefone}
          buildingId={buildingId}
          role={role}
          onDeleted={(sbId) => setList((prev) => prev.filter((p) => p.sbId !== sbId))}
        />
        {sheetFieldsOn && (
          <SheetFields
            key={s.sbId}
            item={s}
            buildingId={buildingId!}
            buildingNome={buildingNome}
            buildingWorkOrder={buildingWorkOrder}
            onSaved={(v) =>
              setList((prev) =>
                prev.map((p) => (p.sbId === s.sbId ? { ...p, ...v } : p))
              )
            }
          />
        )}
      </div>
      <StaffHoursCard
        staffId={s.id}
        sbId={s.sbId}
        initialHours={s.horasSemana ?? null}
        buildingId={buildingId}
        role={role}
        onSaved={(horas) =>
          setList((prev) => prev.map((p) => (p.sbId === s.sbId ? { ...p, horasSemana: horas } : p)))
        }
      />
    </>
  );

  return (
    <div className="space-y-2">
      {(canReorder || (role === "cleaner" && !!buildingId)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink/50">
          <span>
            {canReorder && (
              <>
                Order:{" "}
                <span className="font-medium text-ink/70">
                  {manual ? "Manual (drag to reorder)" : "Automatic (by hours) — drag to reorder"}
                </span>
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            {canReorder && manual && (
              <button
                type="button"
                onClick={resetOrder}
                disabled={savingOrder}
                className="flex items-center gap-1 rounded-md border border-line px-2 py-1 font-medium text-ink/60 transition hover:border-petrol hover:text-petrol disabled:opacity-50"
              >
                <RotateCcw size={12} />
                Reset to automatic
              </button>
            )}
            {role === "cleaner" && !!buildingId && (
              <button
                type="button"
                onClick={() => setShowSheetFields((v) => !v)}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition ${
                  showSheetFields
                    ? "border-petrol bg-petrolLight text-petrol"
                    : "border-line text-ink/60 hover:border-petrol hover:text-petrol"
                }`}
              >
                <Tag size={12} />
                Sheet labels
              </button>
            )}
          </div>
        </div>
      )}

      {canReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedList.map((s) => s.sbId)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedList.map((s, i) => (
                <SortableCleanerRow key={s.sbId} item={s} position={i + 1}>
                  {staffRow(s)}
                </SortableCleanerRow>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        sortedList.map((s, i) => (
          <div key={s.sbId} className="flex items-start gap-2">
            <span className="mt-3 w-5 shrink-0 text-center font-mono text-xs text-ink/40">{i + 1}</span>
            {staffRow(s)}
          </div>
        ))
      )}

      {openSlots.map((slot, i) => (
        <div
          key={slot.id}
          className="flex items-center justify-between gap-2 rounded-md border border-dashed border-line bg-surface px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm text-ink/40">
            <span className="w-5 shrink-0 text-center font-mono text-xs">{sortedList.length + i + 1}</span>
            Open slot
          </span>

          {editingSlotId === slot.id ? (
            <span className="flex items-center gap-1 rounded-md border border-petrol bg-white px-2 py-1.5 text-xs">
              <input
                type="number"
                min={1}
                step={0.25}
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveSlotHours(slot.id)}
                className="w-14 border-none bg-transparent text-ink outline-none"
              />
              <span className="text-ink/50">h/wk</span>
              <button onClick={() => saveSlotHours(slot.id)} className="text-petrol hover:text-petrolDark">
                <Check size={14} />
              </button>
              <button onClick={() => setEditingSlotId(null)} className="text-ink/40 hover:text-ink">
                <X size={14} />
              </button>
            </span>
          ) : (
            <button
              onClick={() => {
                setEditingSlotId(slot.id);
                setEditValue(slot.horas.toString());
              }}
              className="flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-ink/60 hover:border-petrol hover:text-petrol"
            >
              <Clock size={13} />
              {slot.horas}h/wk
              <Pencil size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
