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
    and.push({
      staff: {
        OR: [{ nome: { contains: q, mode: "insensitive" } }, { staffNumber: { contains: q, mode: "insensitive" } }],
      },
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
        staffId: e.staffId.toString(),
        staffNome: e.staff.nome,
        staffNumber: e.staff.staffNumber,
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
