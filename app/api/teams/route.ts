import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { getTeamsData } from "@/lib/teams";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const teams = await getTeamsData();
  return NextResponse.json(toJSONSafe(teams));
}

// Cria um time vazio (sem prédio, sem líder) — prédios e líder são conectados
// depois, em /teams/[id] ou em cada prédio (ver /api/buildings/[id]).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const number = body?.number;
  if (number !== undefined && number !== null && (typeof number !== "number" || !Number.isInteger(number) || number < 0)) {
    return NextResponse.json({ error: "Invalid team number" }, { status: 400 });
  }

  const created = await prisma.team.create({ data: { number: number ?? null } });
  return NextResponse.json(toJSONSafe({ id: created.id.toString(), number: created.number }), { status: 201 });
}
