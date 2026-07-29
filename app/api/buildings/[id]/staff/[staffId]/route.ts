import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; staffId: string } }
) {
  try {
    await prisma.staffBuilding.delete({
      where: {
        staffId_buildingId: {
          staffId: BigInt(params.staffId),
          buildingId: BigInt(params.id),
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });
  }
}
