import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { connectTeamLeader } from "@/lib/teams";

// Conecta um team leader a este time (upsert: se já estiver conectado, só
// atualiza as horas) — um time pode ter mais de um (co-liderança). Pra
// desconectar, ver DELETE /api/teams/[id]/leaders/[staffId].
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const { staffId } = body;
  const horas = body.horas;

  if (!staffId || typeof staffId !== "string") {
    return NextResponse.json({ error: "Missing team leader" }, { status: 400 });
  }
  if (horas !== undefined && horas !== null && (typeof horas !== "number" || horas < 0)) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
  }

  const teamId = BigInt(params.id);
  const staffIdBig = BigInt(staffId);

  const [team, staff] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId } }),
    prisma.staff.findUnique({ where: { id: staffIdBig } }),
  ]);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  await connectTeamLeader(teamId, staffIdBig, horas ?? null);

  return NextResponse.json(toJSONSafe({ teamId: teamId.toString(), staffId, horas: horas ?? null }));
}
