import BuildingStaffClient from "@/components/BuildingStaffClient";
import BuildingHoursCard from "@/components/BuildingHoursCard";
import UcdHoursCard from "@/components/UcdHoursCard";
import WorkOrderCard from "@/components/WorkOrderCard";
import BuildingSlotsCard from "@/components/BuildingSlotsCard";
import BuildingStatsBadge from "@/components/BuildingStatsBadge";
import BuildingTeamPicker from "@/components/BuildingTeamPicker";
import RemoveFromTeamButton from "@/components/RemoveFromTeamButton";

type StaffLine = {
  id: string;
  // id do vínculo StaffBuilding — o mesmo staff pode ter mais de um vínculo
  // de cleaner no mesmo prédio (ver schema.prisma).
  sbId: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  horasSemana?: number | null;
  // Posição manual na folha (ver lib/timesheetRows.ts). Null = ordem
  // automática por horas.
  ordem?: number | null;
  // Building/WO próprios desta pessoa na folha (ver StaffBuilding). Vazio =
  // usa o do prédio.
  predioLabel?: string | null;
  workOrder?: string | null;
};

export type BuildingCardData = {
  id: string;
  nome: string;
  ucdHours: number | null;
  horasDisponiveis: number | null;
  workOrder: string | null;
  teamId?: string | null;
  teamNumber?: number | null;
  teamLeaderName?: string | null;
  slots: { id: string; horas: number }[];
  cleaners: StaffLine[];
};

// Bloco completo de um prédio: cabeçalho editável (horas/WO/time), vagas
// fixas e cleaners. Usado tanto em /buildings/[id] (um prédio por página)
// quanto empilhado em /teams/[id] (todos os prédios de um team leader
// juntos) — mesma composição de cards, só o wrapper muda. O time do prédio
// (badge "Team N") mostra quem lidera; não repete um bloco "Team Leader"
// por prédio porque isso já fica claro no cabeçalho de /teams/[id].
export default function BuildingCard({
  building,
  bordered = false,
  teamContext = false,
}: {
  building: BuildingCardData;
  bordered?: boolean;
  // Em /teams/[id] o time já é óbvio pelo contexto da página, então troca o
  // seletor completo (mover pra outro time) por um simples "remover".
  teamContext?: boolean;
}) {
  return (
    <div className={bordered ? "rounded-md border border-line bg-white p-4 sm:p-6" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-ink/40">Building</p>
            <h2 className="font-display text-2xl font-bold text-ink">{building.nome}</h2>
          </div>
          <UcdHoursCard buildingId={building.id} initialHours={building.ucdHours} />
          <BuildingHoursCard buildingId={building.id} initialHours={building.horasDisponiveis} />
          <WorkOrderCard buildingId={building.id} initialWorkOrder={building.workOrder} />
          {teamContext ? (
            <RemoveFromTeamButton buildingId={building.id} />
          ) : (
            <BuildingTeamPicker
              buildingId={building.id}
              initialTeamId={building.teamId ?? null}
              initialTeamNumber={building.teamNumber ?? null}
              initialLeaderName={building.teamLeaderName ?? null}
            />
          )}
        </div>
        <BuildingStatsBadge
          horasDisponiveis={building.horasDisponiveis}
          cleaners={building.cleaners}
          slots={building.slots}
        />
      </div>

      <div className="mt-4">
        <BuildingSlotsCard buildingId={building.id} initialSlots={building.slots} />
      </div>

      <div className="mt-8">
        <h3 className="mb-3 font-display text-lg font-bold text-petrol">Cleaners</h3>
        <BuildingStaffClient
          staff={building.cleaners}
          emptyLabel="No cleaner assigned to this building."
          slots={building.slots}
          buildingId={building.id}
          buildingNome={building.nome}
          buildingWorkOrder={building.workOrder}
          role="cleaner"
        />
      </div>
    </div>
  );
}
