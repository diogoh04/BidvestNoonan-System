import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInputSchema } from "@/lib/validation";
import { toJSONSafe, StaffDTO } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { connectTeamLeader, disconnectTeamLeader } from "@/lib/teams";
import { syncBuildingAssignments, closeAllOpenForStaff } from "@/lib/staffHistory";

function mapStaff(w: any, teamsLed: StaffDTO["teamsLed"] = []): StaffDTO {
  return {
    id: w.id.toString(),
    nome: w.nome,
    telefone: w.telefone,
    staffNumber: w.staffNumber,
    createdAt: w.createdAt ? w.createdAt.toISOString() : null,
    buildings: (w.buildingsAsTeamLeader ?? []).map((sb: any) => ({
      id: sb.building.id.toString(),
      nome: sb.building.nome,
      role: sb.role,
      horas: sb.horas,
    })),
    teamsLed,
    status: w.status ?? null,
    blockedAt: w.blockedAt ? w.blockedAt.toISOString() : null,
    lastWorkingDay: w.lastWorkingDay ? w.lastWorkingDay.toISOString() : null,
    voluntaryLeave: w.voluntaryLeave ?? null,
    leaveReasons: w.leaveReasons ?? [],
    leaveReasonNote: w.leaveReasonNote ?? null,
    lastBuildingName: w.lastBuildingName ?? null,
    leDestinationCompany: w.leDestinationCompany ?? null,
  };
}

async function getTeamsLed(staffId: bigint): Promise<StaffDTO["teamsLed"]> {
  const links = await prisma.teamLeader.findMany({ where: { staffId }, include: { team: true } });
  return links.map((l) => ({ teamId: l.teamId.toString(), number: l.team.number, horas: l.horas }));
}


export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const staff = await prisma.staff.findUnique({
    where: { id: BigInt(params.id) },
    include: {
      buildingsAsTeamLeader: { include: { building: true } },
      observations: { orderBy: { data: "desc" } },
    },
  });

  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const teamsLed = await getTeamsLed(staff.id);

  return NextResponse.json(
    toJSONSafe({
      ...mapStaff(staff, teamsLed),
      observations: staff.observations.map((f) => ({
        id: f.id.toString(),
        texto: f.texto,
        data: f.data ? f.data.toISOString() : null,
      })),
    })
  );
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = staffInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const staffId = BigInt(params.id);

  // Staff com status especial (P45/LE/Blocked) não tem vínculo real de
  // prédio — ignora quaisquer assignments/teamsLed enviados nesse caso.
  const assignments = data.status ? [] : data.assignments;
  const teamsLed = data.status ? [] : data.teamsLed;

  // Times que este staff lidera ANTES desta edição — usado depois pra saber
  // quais desconectar (os que saíram da lista) — ver loop de sincronização
  // logo abaixo do update.
  const previouslyLedTeamIds = (await prisma.teamLeader.findMany({ where: { staffId }, select: { teamId: true } })).map(
    (t) => t.teamId
  );

  // P45: antes de apagar os vínculos de prédio (logo abaixo), guarda o
  // nome do último prédio pro relatório de saída (lib/p45Report.ts) —
  // preferindo o vínculo "cleaner" quando o staff tem mais de um. Se não
  // sobrar nenhum vínculo pra capturar agora (ex.: reeditando um P45 que já
  // teve os vínculos apagados numa edição anterior), `undefined` faz o
  // Prisma não mexer no campo, preservando o valor já salvo.
  let lastBuildingName: string | null | undefined;
  if (data.status === "p45") {
    const currentLinks = await prisma.staffBuilding.findMany({
      where: { staffId },
      include: { building: true },
    });
    const picked = currentLinks.find((l) => l.role === "cleaner") ?? currentLinks[0];
    lastBuildingName = picked ? picked.building.nome : undefined;
  } else {
    lastBuildingName = null;
  }

  await prisma.staffBuilding.deleteMany({ where: { staffId } });

  const updated = await prisma.staff.update({
    where: { id: staffId },
    data: {
      nome: data.nome,
      staffNumber: data.staffNumber || null,
      telefone: data.telefone || null,
      status: data.status ?? null,
      blockedAt: data.status === "blocked" && data.blockedAt ? new Date(data.blockedAt) : null,
      lastWorkingDay:
        (data.status === "p45" || data.status === "le") && data.lastWorkingDay
          ? new Date(data.lastWorkingDay)
          : null,
      voluntaryLeave: data.status === "p45" ? data.voluntaryLeave ?? null : null,
      leaveReasons: data.status === "p45" && data.voluntaryLeave === false ? data.leaveReasons : [],
      leaveReasonNote:
        data.status === "p45" && data.voluntaryLeave === false
          ? data.leaveReasonNote?.trim() || null
          : null,
      leDestinationCompany: data.status === "le" ? data.leDestinationCompany?.trim() || null : null,
      lastBuildingName,
      buildingsAsTeamLeader:
        assignments.length > 0
          ? {
              create: assignments.map((a) => ({
                buildingId: BigInt(a.buildingId),
                role: a.role,
                horas: a.horas ?? null,
              })),
            }
          : undefined,
    },
    include: { buildingsAsTeamLeader: { include: { building: true } } },
  });

  // Sincroniza TeamLeader com a lista enviada: desconecta os times que
  // saíram, conecta/atualiza horas dos que ficaram ou entraram. O
  // deleteMany(staffBuilding) acima já apagou os vínculos legados
  // role="team_leader" deste staff — connectTeamLeader recria os que ainda
  // valem (ver lib/teams.ts). Cada connect/disconnect já abre/fecha o
  // histórico de liderança sozinho (idempotente).
  const newTeamIds = new Set(teamsLed.map((t) => BigInt(t.teamId).toString()));
  for (const teamId of previouslyLedTeamIds) {
    if (!newTeamIds.has(teamId.toString())) {
      await disconnectTeamLeader(teamId, staffId);
    }
  }
  for (const t of teamsLed) {
    await connectTeamLeader(BigInt(t.teamId), staffId, t.horas ?? null);
  }

  // Histórico de prédio (ver lib/staffHistory.ts) — diffa contra o que já
  // estava aberto no histórico (não contra StaffBuilding, apagado acima),
  // então só fecha/abre o que realmente mudou.
  await syncBuildingAssignments(
    staffId,
    assignments.filter((a) => a.role === "cleaner").map((a) => ({ buildingId: BigInt(a.buildingId), horas: a.horas ?? null }))
  );
  // Status especial: fecha qualquer coisa que ainda esteja aberta (hoje só
  // sobra "cover" — prédio/time já ficam vazios acima nesse caso).
  if (data.status) {
    await closeAllOpenForStaff(staffId);
  }

  return NextResponse.json(toJSONSafe(mapStaff(updated, await getTeamsLed(staffId))));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.staff.delete({ where: { id: BigInt(params.id) } });
  return NextResponse.json({ ok: true });
}
