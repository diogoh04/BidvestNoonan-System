import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSONSafe } from "@/lib/types";
import { getCurrentUser, hasRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Linha do tempo de um staff: prédios (cleaner), times liderados e covers —
// ver model StaffHistory no schema.prisma. Só Master (mesmo padrão das
// outras telas de gestão adicionadas esta sessão — /teams, /hours-control).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const entries = await prisma.staffHistory.findMany({
    where: { staffId: BigInt(params.id) },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
  });

  return NextResponse.json(
    toJSONSafe(
      entries.map((e) => ({
        id: e.id.toString(),
        kind: e.kind,
        staffId: e.staffId.toString(),
        buildingId: e.buildingId ? e.buildingId.toString() : null,
        buildingName: e.buildingName,
        teamId: e.teamId ? e.teamId.toString() : null,
        teamNumber: e.teamNumber,
        horas: e.horas,
        startedAt: e.startedAt.toISOString(),
        endedAt: e.endedAt ? e.endedAt.toISOString() : null,
        note: e.note,
      }))
    )
  );
}
