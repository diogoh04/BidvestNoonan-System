import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Relatório geral: todas as trocas de prédio/time/cover de todo mundo — ver
// model StaffHistory no schema.prisma. Master-only. Filtros por query
// string, todos opcionais.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const buildingId = searchParams.get("buildingId");
  const teamId = searchParams.get("teamId");
  const open = searchParams.get("open");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q")?.trim();
  const take = Math.min(Number(searchParams.get("take")) || 100, 500);
  const skip = Math.max(Number(searchParams.get("skip")) || 0, 0);

  const and: any[] = [];
  if (kind === "building" || kind === "team_leader" || kind === "team_leader_cover") and.push({ kind });
  if (buildingId) and.push({ buildingId: BigInt(buildingId) });
  if (teamId) and.push({ teamId: BigInt(teamId) });
  if (open) and.push({ endedAt: null });
  // Sobreposição de intervalo: começou antes do fim do período pedido, e
  // (ainda está aberto OU terminou depois do início do período pedido).
  if (to) and.push({ startedAt: { lte: new Date(to) } });
  if (from) and.push({ OR: [{ endedAt: null }, { endedAt: { gte: new Date(from) } }] });
  if (q) {
    // Cobre tanto quem tem Staff cadastrado (busca no relacionamento)
    // quanto entrada solta sem cadastro (busca nas colunas staffNome/
    // staffNumber direto na linha — ver comentário do model).
    and.push({
      OR: [
        { staff: { OR: [{ nome: { contains: q, mode: "insensitive" } }, { staffNumber: { contains: q, mode: "insensitive" } }] } },
        { staffNome: { contains: q, mode: "insensitive" } },
        { staffNumber: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const where = and.length > 0 ? { AND: and } : {};

  const [items, total] = await Promise.all([
    prisma.staffHistory.findMany({
      where,
      include: { staff: { select: { nome: true, staffNumber: true } } },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take,
      skip,
    }),
    prisma.staffHistory.count({ where }),
  ]);

  return NextResponse.json(
    toJSONSafe({
      total,
      items: items.map((e) => ({
        id: e.id.toString(),
        kind: e.kind,
        staffId: e.staffId ? e.staffId.toString() : null,
        staffNome: e.staff?.nome ?? e.staffNome,
        staffNumber: e.staff?.staffNumber ?? e.staffNumber,
        buildingId: e.buildingId ? e.buildingId.toString() : null,
        buildingName: e.buildingName,
        teamId: e.teamId ? e.teamId.toString() : null,
        teamNumber: e.teamNumber,
        horas: e.horas,
        startedAt: e.startedAt.toISOString(),
        endedAt: e.endedAt ? e.endedAt.toISOString() : null,
        note: e.note,
      })),
    })
  );
}

// Adiciona uma entrada manual de histórico de prédio (ver
// BuildingStaffHistoryCard, em /buildings/[id]) — pra completar o que a
// sincronização automática (lib/staffHistory.ts, disparada ao salvar o
// staff) não cobre: gente que passou pelo prédio antes dessa trilha existir,
// ou um ajuste pontual. Só kind="building" — as outras (team_leader,
// team_leader_cover) continuam só automáticas.
//
// Aceita ou staffId (staff cadastrado, o fluxo normal) ou staffNome (texto
// livre, sem cadastro — ex.: alguém que saiu há muito tempo e nunca foi
// cadastrado ou não está mais no sistema). staffNumber é sempre opcional,
// mas só faz sentido informar junto de staffNome (quando há staffId, o
// número vem do cadastro).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const staffIdStr = typeof body.staffId === "string" ? body.staffId : null;
  const staffNomeInput = typeof body.staffNome === "string" ? body.staffNome.trim() : "";
  const staffNumberInput = typeof body.staffNumber === "string" ? body.staffNumber.trim() : "";
  const buildingIdStr = typeof body.buildingId === "string" ? body.buildingId : null;
  const asFormer = body.asFormer === true;

  if (!buildingIdStr) {
    return NextResponse.json({ error: "buildingId is required" }, { status: 400 });
  }
  if (!staffIdStr && !staffNomeInput) {
    return NextResponse.json({ error: "staffId or staffNome is required" }, { status: 400 });
  }

  let buildingId: bigint;
  try {
    buildingId = BigInt(buildingIdStr);
  } catch {
    return NextResponse.json({ error: "Invalid buildingId" }, { status: 400 });
  }

  const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { nome: true } });
  if (!building) return NextResponse.json({ error: "Building not found" }, { status: 404 });

  let staffId: bigint | null = null;
  let resolvedNome: string | null = null;
  let resolvedNumber: string | null = null;

  if (staffIdStr) {
    try {
      staffId = BigInt(staffIdStr);
    } catch {
      return NextResponse.json({ error: "Invalid staffId" }, { status: 400 });
    }
    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { nome: true, staffNumber: true } });
    if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    resolvedNome = staff.nome;
    resolvedNumber = staff.staffNumber;

    if (!asFormer) {
      // Evita duas linhas "current" pro mesmo staff+prédio — se já tem uma
      // aberta (automática ou manual), não duplica.
      const open = await prisma.staffHistory.findFirst({
        where: { staffId, kind: "building", buildingId, endedAt: null },
      });
      if (open) {
        return NextResponse.json({ error: "This staff is already listed as current for this building" }, { status: 409 });
      }
    }
  } else {
    // Entrada solta, sem Staff cadastrado — não checa duplicata (nome pode
    // se repetir entre pessoas diferentes de verdade).
    resolvedNome = staffNomeInput;
    resolvedNumber = staffNumberInput || null;
  }

  const now = new Date();
  const created = await prisma.staffHistory.create({
    data: {
      staffId,
      staffNome: staffId ? null : resolvedNome,
      staffNumber: staffId ? null : resolvedNumber,
      kind: "building",
      buildingId,
      buildingName: building.nome,
      startedAt: now,
      endedAt: asFormer ? now : null,
    },
  });

  return NextResponse.json(
    toJSONSafe({
      id: created.id.toString(),
      kind: created.kind,
      staffId: created.staffId ? created.staffId.toString() : null,
      staffNome: resolvedNome,
      staffNumber: resolvedNumber,
      buildingId: created.buildingId ? created.buildingId.toString() : null,
      buildingName: created.buildingName,
      startedAt: created.startedAt.toISOString(),
      endedAt: created.endedAt ? created.endedAt.toISOString() : null,
    }),
    { status: 201 }
  );
}
