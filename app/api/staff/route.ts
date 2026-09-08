import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffInputSchema } from "@/lib/validation";
import { toJSONSafe, StaffDTO } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { connectTeamLeader } from "@/lib/teams";
import { syncBuildingAssignments } from "@/lib/staffHistory";

function mapStaff(w: any, teamsLed: StaffDTO["teamsLed"] = []): StaffDTO {
  return {
    id: w.id.toString(),
    nome: w.nome,
    telefone: w.telefone,
    staffNumber: w.staffNumber,
    createdAt: w.createdAt ? w.createdAt.toISOString() : null,
    buildings: (w.buildingsAsTeamLeader ?? []).map((sb: any) => ({
      id: sb.building.id.toString(),
      sbId: sb.id.toString(),
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

// GET /api/staff?q=nome ou staff number&buildingId=123&role=cleaner&status=p45&noBuilding=1
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  // Team Leader só usa a busca (autocomplete de cover na folha de ponto) —
  // devolve um formato reduzido, sem dados de outros vínculos/observações.
  if (hasRole(user, "team_leader")) {
    if (!q) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    const staff = await prisma.staff.findMany({
      where: {
        OR: [
          { nome: { contains: q, mode: "insensitive" } },
          { staffNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { nome: "asc" },
      take: 20,
    });
    return NextResponse.json(
      toJSONSafe(staff.map((s) => ({ id: s.id.toString(), nome: s.nome, staffNumber: s.staffNumber })))
    );
  }

  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const buildingId = searchParams.get("buildingId");
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const noBuilding = searchParams.get("noBuilding");

  const and: any[] = [];

  if (role === "cleaner" || role === "team_leader") {
    and.push({ buildingsAsTeamLeader: { some: { role } } });
  }

  if (status === "p45" || status === "le" || status === "blocked" || status === "sick") {
    and.push({ status });
  }

  if (q) {
    and.push({
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        { staffNumber: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (noBuilding) {
    // Staff ativo (sem status especial) e sem nenhum vínculo de prédio.
    // Não checa o campo legado Staff.buildingId — ele não é mais escrito
    // por nenhuma rota atual e pode ter lixo de antes do sistema de
    // vínculos (StaffBuilding), o que excluiria gente sem prédio de verdade.
    and.push({ buildingsAsTeamLeader: { none: {} }, status: null });
  } else if (buildingId) {
    and.push({ buildingsAsTeamLeader: { some: { buildingId: BigInt(buildingId) } } });
  }

  const where: any = and.length > 0 ? { AND: and } : {};

  const staff = await prisma.staff.findMany({
    where,
    include: { buildingsAsTeamLeader: { include: { building: true } } },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(toJSONSafe(staff.map((s) => mapStaff(s))));
}

// POST /api/staff  - cadastra cleaner ou team leader
export async function POST(req: NextRequest) {
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

  // Staff com status especial (P45/LE/Blocked) não tem vínculo real de
  // prédio — ignora quaisquer assignments/teamsLed enviados nesse caso.
  const assignments = data.status ? [] : data.assignments;
  const teamsLed = data.status ? [] : data.teamsLed;

  const created = await prisma.staff.create({
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
      // Staff criado direto como P45 nunca teve vínculo de prédio pra
      // capturar (assignments são ignorados acima) — diferente do PUT em
      // app/api/staff/[id]/route.ts, que captura de um vínculo existente.
      lastBuildingName: null,
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

  // Histórico (ver lib/staffHistory.ts) — abre uma entrada por prédio de
  // cleaner logo na criação (role="team_leader" em assignments é legado, não
  // gera histórico de prédio — ver comentário no schema.prisma).
  await syncBuildingAssignments(
    created.id,
    assignments.filter((a) => a.role === "cleaner").map((a) => ({ buildingId: BigInt(a.buildingId), horas: a.horas ?? null }))
  );

  // Conecta o staff recém-criado como líder de cada time selecionado (ver
  // lib/teams.ts:connectTeamLeader — já cuida do vínculo legado de acesso e
  // do histórico de liderança).
  for (const t of teamsLed) {
    await connectTeamLeader(BigInt(t.teamId), created.id, t.horas ?? null);
  }

  const resultTeamsLed = teamsLed.map((t) => ({ teamId: t.teamId, number: null, horas: t.horas ?? null }));

  return NextResponse.json(toJSONSafe(mapStaff(created, resultTeamsLed)), { status: 201 });
}
