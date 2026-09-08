import { prisma } from "@/lib/prisma";

// Trilha/histórico do staff — ver comentário do model StaffHistory no
// schema.prisma. Todo `open*` é idempotente (não cria linha duplicada se já
// tiver uma aberta pro mesmo staff+alvo+kind) e todo `close*` não quebra se
// não tiver nada aberto — isso é o que permite chamar essas funções direto
// dos loops que já existem (ex.: reconectar um team leader que não mudou)
// sem se preocupar em checar antes.

function isUniqueConstraintError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// ---------- building (cleaner num prédio) ----------

export async function openBuildingAssignment(
  staffId: bigint,
  buildingId: bigint,
  opts?: { horas?: number | null; startedAt?: Date }
) {
  const open = await prisma.staffHistory.findFirst({
    where: { staffId, kind: "building", buildingId, endedAt: null },
  });
  if (open) {
    if (opts?.horas !== undefined) await prisma.staffHistory.update({ where: { id: open.id }, data: { horas: opts.horas } });
    return;
  }

  const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { nome: true } });
  try {
    await prisma.staffHistory.create({
      data: {
        staffId,
        kind: "building",
        buildingId,
        buildingName: building?.nome ?? null,
        horas: opts?.horas ?? null,
        startedAt: opts?.startedAt ?? new Date(),
      },
    });
  } catch (e) {
    if (!isUniqueConstraintError(e)) throw e;
  }
}

export async function closeBuildingAssignment(staffId: bigint, buildingId: bigint, endedAt?: Date) {
  await prisma.staffHistory.updateMany({
    where: { staffId, kind: "building", buildingId, endedAt: null },
    data: { endedAt: endedAt ?? new Date() },
  });
}

// Diff usado pelo POST/PUT de staff — `assignments` já filtrado pra só
// role="cleaner". Compara contra as entradas HOJE ABERTAS (não contra
// StaffBuilding, que é apagado e recriado a cada save — ver comentário no
// schema.prisma), então fecha só o que realmente saiu e abre só o que
// realmente entrou; o que não mudou fica intocado.
//
// O histórico é por prédio (uma trilha "trabalhou aqui de X até Y"), não por
// vínculo — então quando o staff tem mais de um vínculo de cleaner no mesmo
// prédio (dois turnos/postos), colapsa numa entrada só, com as horas somadas.
export async function syncBuildingAssignments(
  staffId: bigint,
  assignments: { buildingId: bigint; horas: number | null }[]
) {
  const byBuilding = new Map<string, { buildingId: bigint; horas: number | null }>();
  for (const a of assignments) {
    const key = a.buildingId.toString();
    const acc = byBuilding.get(key);
    if (acc) {
      acc.horas = (acc.horas ?? 0) + (a.horas ?? 0);
    } else {
      byBuilding.set(key, { buildingId: a.buildingId, horas: a.horas });
    }
  }

  const open = await prisma.staffHistory.findMany({
    where: { staffId, kind: "building", endedAt: null },
    select: { buildingId: true },
  });
  const openIds = new Set(open.map((o) => o.buildingId!.toString()));

  for (const buildingId of openIds) {
    if (!byBuilding.has(buildingId)) await closeBuildingAssignment(staffId, BigInt(buildingId));
  }
  for (const a of byBuilding.values()) {
    if (!openIds.has(a.buildingId.toString())) {
      await openBuildingAssignment(staffId, a.buildingId, { horas: a.horas });
    }
  }
}

// ---------- team_leader (conexão real, ver lib/teams.ts) ----------

export async function openTeamLeadership(
  staffId: bigint,
  teamId: bigint,
  opts?: { horas?: number | null; startedAt?: Date }
) {
  const open = await prisma.staffHistory.findFirst({
    where: { staffId, kind: "team_leader", teamId, endedAt: null },
  });
  if (open) {
    if (opts?.horas !== undefined) await prisma.staffHistory.update({ where: { id: open.id }, data: { horas: opts.horas } });
    return;
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { number: true } });
  try {
    await prisma.staffHistory.create({
      data: {
        staffId,
        kind: "team_leader",
        teamId,
        teamNumber: team?.number ?? null,
        horas: opts?.horas ?? null,
        startedAt: opts?.startedAt ?? new Date(),
      },
    });
  } catch (e) {
    if (!isUniqueConstraintError(e)) throw e;
  }
}

export async function closeTeamLeadership(staffId: bigint, teamId: bigint, endedAt?: Date) {
  await prisma.staffHistory.updateMany({
    where: { staffId, kind: "team_leader", teamId, endedAt: null },
    data: { endedAt: endedAt ?? new Date() },
  });
}

// ---------- team_leader_cover (novo — ver /teams/[id]) ----------

export async function openTeamLeaderCover(
  staffId: bigint,
  teamId: bigint,
  data: { startedAt: Date; endedAt?: Date | null; note?: string | null }
): Promise<{ id: bigint } | { error: "already_open" }> {
  if (!data.endedAt) {
    const open = await prisma.staffHistory.findFirst({
      where: { staffId, kind: "team_leader_cover", teamId, endedAt: null },
    });
    if (open) return { error: "already_open" };
  }

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { number: true } });
  try {
    const created = await prisma.staffHistory.create({
      data: {
        staffId,
        kind: "team_leader_cover",
        teamId,
        teamNumber: team?.number ?? null,
        startedAt: data.startedAt,
        endedAt: data.endedAt ?? null,
        note: data.note?.trim() || null,
      },
    });
    return { id: created.id };
  } catch (e) {
    if (isUniqueConstraintError(e)) return { error: "already_open" };
    throw e;
  }
}

export async function closeTeamLeaderCover(id: bigint, endedAt: Date) {
  const result = await prisma.staffHistory.updateMany({
    where: { id, kind: "team_leader_cover", endedAt: null },
    data: { endedAt },
  });
  return result.count > 0;
}

// ---------- limpeza usada nos fluxos de exclusão/status ----------

export async function closeOpenForBuilding(buildingId: bigint, endedAt?: Date) {
  await prisma.staffHistory.updateMany({
    where: { kind: "building", buildingId, endedAt: null },
    data: { endedAt: endedAt ?? new Date() },
  });
}

export async function closeOpenCoversForTeam(teamId: bigint, endedAt?: Date) {
  await prisma.staffHistory.updateMany({
    where: { kind: "team_leader_cover", teamId, endedAt: null },
    data: { endedAt: endedAt ?? new Date() },
  });
}

// Fecha QUALQUER entrada aberta de um staff, de qualquer kind — usado quando
// o status vira P45/LE/Blocked/Sick (assignments/teamsLed já ficam vazios
// nesse fluxo, o que fecha building/team_leader; isso aqui pega o que sobra,
// hoje só cover).
export async function closeAllOpenForStaff(staffId: bigint, endedAt?: Date) {
  await prisma.staffHistory.updateMany({
    where: { staffId, endedAt: null },
    data: { endedAt: endedAt ?? new Date() },
  });
}
