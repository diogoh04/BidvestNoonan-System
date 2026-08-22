import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { getTeamsData, disconnectTeamLeader } from "@/lib/teams";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const [team] = await getTeamsData(BigInt(params.id));
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  return NextResponse.json(toJSONSafe(team));
}

// Edita o número do time. Líder(es) são geridos em /api/teams/[id]/leaders
// (pode ter mais de um); prédios não são tocados aqui — ver
// /api/buildings/[id] (campo teamId).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const data: any = {};

  if ("number" in body) {
    const number = body.number;
    if (number !== null && (typeof number !== "number" || !Number.isInteger(number) || number < 0)) {
      return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
    }
    data.number = number;
  }

  const updated = await prisma.team.update({ where: { id: BigInt(params.id) }, data });

  return NextResponse.json(toJSONSafe({ id: updated.id.toString(), number: updated.number }));
}

// Apaga o time — usado pra limpar, um por um, os times que a migration 15
// criou automaticamente a partir do vínculo legado (backfill) e que você não
// quer manter. Os prédios não são apagados, só ficam sem time (teamId volta
// a NULL, ver Building.team no schema.prisma); os líderes conectados também
// são desconectados primeiro (limpa o vínculo legado de acesso de cada um).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const teamId = BigInt(params.id);
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { leaders: true } });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  for (const l of team.leaders) {
    await disconnectTeamLeader(teamId, l.staffId);
  }
  await prisma.team.delete({ where: { id: teamId } });

  return NextResponse.json({ ok: true });
}
