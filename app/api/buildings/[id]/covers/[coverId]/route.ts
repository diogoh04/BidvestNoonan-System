import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; coverId: string } }
) {
  await prisma.buildingCover.deleteMany({
    where: { id: BigInt(params.coverId), buildingId: BigInt(params.id) },
  });
  return NextResponse.json({ ok: true });
}
