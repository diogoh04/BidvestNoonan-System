import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; coverId: string } }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  await prisma.buildingCover.deleteMany({
    where: { id: BigInt(params.coverId), buildingId: BigInt(params.id) },
  });
  return NextResponse.json({ ok: true });
}
