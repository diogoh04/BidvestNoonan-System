import { prisma } from "@/lib/prisma";
import { openTeamLeadership, closeTeamLeadership } from "@/lib/staffHistory";

// --- Sincronização com o vínculo legado StaffBuilding.role="team_leader" ---
// O portal de autoatendimento do Team Leader (login "team_leader": /my,
// /my/timesheets, fortnight plans, adjustments, review — ver lib/auth.ts e
// app/api/timesheets/**) decide o que cada usuário pode ver/editar checando
// esse vínculo antigo, não o Team novo. Pra não quebrar esse portal (que
// continua em produção, sem relação com a reforma de /teams), toda mudança
// feita através do Team precisa espelhar esse vínculo:
//   - trocar o time de um prédio -> tira o link de TODOS os líderes do time
//     antigo desse prédio, cria o link de TODOS os líderes do time novo;
//   - conectar/desconectar um líder de um time -> cria/tira o link dele em
//     TODOS os prédios do time.
// Sem isso, o Team vira só uma "etiqueta" sem efeito real no acesso.

// Chamado por PATCH /api/buildings/[id] quando building.teamId muda.
export async function syncBuildingTeamChange(buildingId: bigint, oldTeamId: bigint | null, newTeamId: bigint | null) {
  const [oldLeaders, newLeaders] = await Promise.all([
    oldTeamId != null ? prisma.teamLeader.findMany({ where: { teamId: oldTeamId } }) : [],
    newTeamId != null ? prisma.teamLeader.findMany({ where: { teamId: newTeamId } }) : [],
  ]);

  for (const l of oldLeaders) {
    await prisma.staffBuilding
      .delete({ where: { staffId_buildingId_role: { staffId: l.staffId, buildingId, role: "team_leader" } } })
      .catch(() => {});
  }
  for (const l of newLeaders) {
    await prisma.staffBuilding.upsert({
      where: { staffId_buildingId_role: { staffId: l.staffId, buildingId, role: "team_leader" } },
      update: {},
      create: { staffId: l.staffId, buildingId, role: "team_leader" },
    });
  }
}

// Conecta (ou atualiza as horas de) um team leader a um time — um time pode
// ter mais de um (co-liderança). Usado por POST /api/teams/[id]/leaders e
// pela seção "Teams (as team leader)" do formulário de staff.
export async function connectTeamLeader(teamId: bigint, staffId: bigint, horas: number | null) {
  await prisma.teamLeader.upsert({
    where: { teamId_staffId: { teamId, staffId } },
    update: { horas },
    create: { teamId, staffId, horas },
  });

  const buildings = await prisma.building.findMany({ where: { teamId }, select: { id: true } });
  for (const b of buildings) {
    await prisma.staffBuilding.upsert({
      where: { staffId_buildingId_role: { staffId, buildingId: b.id, role: "team_leader" } },
      update: {},
      create: { staffId, buildingId: b.id, role: "team_leader" },
    });
  }

  // Histórico (ver lib/staffHistory.ts) — idempotente, então chamar isso
  // pra um líder que já estava conectado (ex.: PUT /api/staff/[id]
  // reconectando todos os times enviados no formulário) não cria linha
  // duplicada, só atualiza as horas se mudaram.
  await openTeamLeadership(staffId, teamId, { horas });
}

// Desconecta um team leader de um time (o time e os outros líderes, se
// houver, continuam).
export async function disconnectTeamLeader(teamId: bigint, staffId: bigint) {
  await prisma.teamLeader.delete({ where: { teamId_staffId: { teamId, staffId } } }).catch(() => {});

  const buildings = await prisma.building.findMany({ where: { teamId }, select: { id: true } });
  if (buildings.length > 0) {
    await prisma.staffBuilding.deleteMany({
      where: { staffId, role: "team_leader", buildingId: { in: buildings.map((b) => b.id) } },
    });
  }

  await closeTeamLeadership(staffId, teamId);
}

// Um Team tem número + prédios alocados + um ou mais team leaders conectados
// (pode não ter nenhum no momento). Devolve o mesmo formato de prédio que
// GET /api/buildings/[id] (slots, cleaners), pra dar pra reaproveitar o
// BuildingCard direto tanto em /teams quanto na grade de /timesheets.
// Compartilhado entre GET /api/teams (lista) e GET /api/teams/[id] (um só)
// pra não duplicar a query.
export async function getTeamsData(onlyTeamId?: bigint) {
  const teams = await prisma.team.findMany({
    where: onlyTeamId != null ? { id: onlyTeamId } : undefined,
    include: { leaders: { include: { staff: true } }, buildings: true },
  });

  const buildingIds = teams.flatMap((t) => t.buildings.map((b) => b.id));
  const teamIds = teams.map((t) => t.id);

  const [cleanerLinks, allSlots, allCovers, activeLeaderCovers] = await Promise.all([
    prisma.staffBuilding.findMany({
      where: { buildingId: { in: buildingIds }, role: "cleaner" },
      include: { staff: true },
    }),
    prisma.buildingSlot.findMany({ where: { buildingId: { in: buildingIds } }, orderBy: { ordem: "asc" } }),
    prisma.buildingCover.findMany({ where: { buildingId: { in: buildingIds } }, orderBy: { createdAt: "asc" } }),
    // Team leaders cobrindo temporariamente (ver StaffHistory.kind ==
    // "team_leader_cover") — não é StaffBuilding/TeamLeader, é só o log.
    prisma.staffHistory.findMany({
      where: { kind: "team_leader_cover", teamId: { in: teamIds }, endedAt: null },
      include: { staff: true },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  function mapBuilding(building: (typeof teams)[number]["buildings"][number]) {
    return {
      id: building.id.toString(),
      nome: building.nome,
      ucdHours: building.ucdHours,
      horasDisponiveis: building.horasDisponiveis,
      workOrder: building.workOrder,
      slots: allSlots.filter((s) => s.buildingId === building.id).map((s) => ({ id: s.id.toString(), horas: s.horas })),
      covers: allCovers
        .filter((c) => c.buildingId === building.id)
        .map((c) => ({ id: c.id.toString(), nome: c.nome, staffNumber: c.staffNumber, horas: c.horas })),
      cleaners: cleanerLinks
        .filter((l) => l.buildingId === building.id)
        .map((l) => ({
          id: l.staff.id.toString(),
          nome: l.staff.nome,
          staffNumber: l.staff.staffNumber,
          telefone: l.staff.telefone,
          horasSemana: l.horas ?? l.staff.horasSemana,
        })),
    };
  }

  return teams
    .map((t) => {
      const leaders = t.leaders.map((l) => ({
        staffId: l.staffId.toString(),
        nome: l.staff.nome,
        staffNumber: l.staff.staffNumber,
        horas: l.horas,
      }));
      const leaderCovers = activeLeaderCovers
        .filter((c) => c.teamId === t.id)
        .map((c) => ({
          id: c.id.toString(),
          staffId: c.staffId.toString(),
          nome: c.staff.nome,
          staffNumber: c.staff.staffNumber,
          startedAt: c.startedAt.toISOString(),
          endedAt: c.endedAt ? c.endedAt.toISOString() : null,
          note: c.note,
        }));
      return {
        id: t.id.toString(),
        number: t.number,
        leaders,
        leaderCovers,
        // Nome/horas "resumidos" pra telas que só têm espaço pra uma linha
        // (grade de /timesheets, Hours Control) — junta todos os líderes.
        leaderName: leaders.length > 0 ? leaders.map((l) => l.nome).join(", ") : null,
        leaderHours: leaders.length > 0 ? leaders.reduce((sum, l) => sum + (l.horas ?? 0), 0) : null,
        buildings: t.buildings.map(mapBuilding),
      };
    })
    .sort((a, b) => {
      if (a.number != null && b.number != null) return a.number - b.number;
      if (a.number != null) return -1;
      if (b.number != null) return 1;
      return (a.leaderName ?? "").localeCompare(b.leaderName ?? "");
    });
}
