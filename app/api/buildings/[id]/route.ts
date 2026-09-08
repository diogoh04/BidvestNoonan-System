import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { syncBuildingTeamChange } from "@/lib/teams";
import { closeOpenForBuilding } from "@/lib/staffHistory";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const buildingId = BigInt(params.id);

  if (hasRole(user, "team_leader")) {
    if (!user.staffId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    const owns = await prisma.staffBuilding.findFirst({
      where: { staffId: BigInt(user.staffId), buildingId, role: "team_leader" },
    });
    if (!owns) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  } else if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    include: { team: { include: { leaders: { include: { staff: true } } } } },
  });
  if (!building) return NextResponse.json({ error: "Building not found" }, { status: 404 });

  const links = await prisma.staffBuilding.findMany({
    where: { buildingId },
    include: { staff: true },
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
  });

  const slots = await prisma.buildingSlot.findMany({
    where: { buildingId },
    orderBy: { ordem: "asc" },
  });

  const covers = await prisma.buildingCover.findMany({
    where: { buildingId },
    orderBy: { createdAt: "asc" },
  });

  const mapLink = (l: (typeof links)[number]) => ({
    id: l.staff.id.toString(),
    sbId: l.id.toString(),
    nome: l.staff.nome,
    staffNumber: l.staff.staffNumber,
    telefone: l.staff.telefone,
    role: l.role,
    horasSemana: l.horas ?? l.staff.horasSemana,
    ordem: l.ordem,
    predioLabel: l.predioLabel,
    workOrder: l.workOrder,
  });

  return NextResponse.json(
    toJSONSafe({
      id: building.id.toString(),
      nome: building.nome,
      ucdHours: building.ucdHours,
      horasDisponiveis: building.horasDisponiveis,
      workOrder: building.workOrder,
      teamId: building.teamId ? building.teamId.toString() : null,
      teamNumber: building.team?.number ?? null,
      teamLeaderName: building.team?.leaders.length ? building.team.leaders.map((l) => l.staff.nome).join(", ") : null,
      slots: slots.map((s) => ({ id: s.id.toString(), horas: s.horas })),
      covers: covers.map((c) => ({
        id: c.id.toString(),
        nome: c.nome,
        staffNumber: c.staffNumber,
        horas: c.horas,
      })),
      cleaners: links.filter((l) => l.role === "cleaner").map(mapLink),
      teamLeaders: links.filter((l) => l.role === "team_leader").map(mapLink),
    })
  );
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const data: any = {};

  if ("nome" in body) {
    const nome = body.nome;
    if (typeof nome !== "string" || nome.trim() === "") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    data.nome = nome.trim();
  }

  if ("horasDisponiveis" in body) {
    const horas = body.horasDisponiveis;
    if (horas !== null && (typeof horas !== "number" || horas < 0)) {
      return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
    }
    data.horasDisponiveis = horas;
  }

  if ("ucdHours" in body) {
    const horas = body.ucdHours;
    if (horas !== null && (typeof horas !== "number" || horas < 0)) {
      return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
    }
    data.ucdHours = horas;
  }

  if ("workOrder" in body) {
    const wo = body.workOrder;
    if (wo !== null && typeof wo !== "string") {
      return NextResponse.json({ error: "Invalid Work Order" }, { status: 400 });
    }
    data.workOrder = wo;
  }

  let teamChange: { old: bigint | null; new: bigint | null } | null = null;
  if ("teamId" in body) {
    const teamId = body.teamId;
    if (teamId !== null && typeof teamId !== "string") {
      return NextResponse.json({ error: "Invalid team" }, { status: 400 });
    }
    const buildingId = BigInt(params.id);
    const current = await prisma.building.findUnique({ where: { id: buildingId }, select: { teamId: true } });
    if (!current) return NextResponse.json({ error: "Building not found" }, { status: 404 });
    const newTeamId = teamId !== null ? BigInt(teamId) : null;
    teamChange = { old: current.teamId, new: newTeamId };
    data.teamId = newTeamId;
    // Entrando num time (novo ou trocando) sempre vai pro fim da ordem
    // daquele time — ver Building.teamOrder no schema — em vez de empatar
    // em 0 e pular pro meio da lista. O usuário reordena com as setas em
    // /teams/[id] se quiser outra posição.
    if (newTeamId != null && newTeamId !== current.teamId) {
      const maxOrder = await prisma.building.aggregate({ where: { teamId: newTeamId }, _max: { teamOrder: true } });
      data.teamOrder = (maxOrder._max.teamOrder ?? -1) + 1;
    }
  }

  try {
    const updated = await prisma.building.update({
      where: { id: BigInt(params.id) },
      data,
    });

    if (teamChange) {
      await syncBuildingTeamChange(updated.id, teamChange.old, teamChange.new);
    }

    return NextResponse.json(
      toJSONSafe({
        id: updated.id.toString(),
        nome: updated.nome,
        ucdHours: updated.ucdHours,
        horasDisponiveis: updated.horasDisponiveis,
        workOrder: updated.workOrder,
        teamId: updated.teamId ? updated.teamId.toString() : null,
      })
    );
  } catch {
    return NextResponse.json({ error: "Could not save (name already exists?)" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const buildingId = BigInt(params.id);

  // Fecha o histórico aberto antes de apagar — senão a linha fica "aberta"
  // pra sempre com o prédio nulo (ver lib/staffHistory.ts).
  await closeOpenForBuilding(buildingId);

  await prisma.building.delete({ where: { id: buildingId } });

  return NextResponse.json({ ok: true });
}
