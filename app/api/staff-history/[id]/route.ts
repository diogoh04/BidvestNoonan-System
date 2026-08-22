import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";

// Apaga uma entrada do histórico — pra corrigir um lançamento errado ou um
// teste (ex.: troca de prédio feita sem querer, cover criado à toa). Some da
// trilha de verdade, sem "efeito" (não desfaz a troca em si, só o registro).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const result = await prisma.staffHistory.deleteMany({ where: { id: BigInt(params.id) } });
  if (result.count === 0) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
