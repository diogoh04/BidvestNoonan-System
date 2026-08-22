import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { teamLeaderCoverCloseSchema } from "@/lib/validation";

// Fecha um cover (endedAt = hoje, ou a data enviada). Escopado a
// {id, teamId, kind} pra um time não conseguir fechar o cover de outro.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; coverId: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = teamLeaderCoverCloseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const endedAt = parsed.data.endedAt ? new Date(`${parsed.data.endedAt}T00:00:00.000Z`) : new Date();

  const result = await prisma.staffHistory.updateMany({
    where: { id: BigInt(params.coverId), teamId: BigInt(params.id), kind: "team_leader_cover" },
    data: { endedAt },
  });

  if (result.count === 0) return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Remove um cover lançado por engano (diferente de fechar — some da trilha).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; coverId: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const result = await prisma.staffHistory.deleteMany({
    where: { id: BigInt(params.coverId), teamId: BigInt(params.id), kind: "team_leader_cover" },
  });

  if (result.count === 0) return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
