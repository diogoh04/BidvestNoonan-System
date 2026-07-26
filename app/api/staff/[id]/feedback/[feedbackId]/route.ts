import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; feedbackId: string } }
) {
  try {
    const result = await prisma.feedback.deleteMany({
      where: { id: BigInt(params.feedbackId), workerId: BigInt(params.id) },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Observação não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Falha ao excluir observação" }, { status: 500 });
  }
}