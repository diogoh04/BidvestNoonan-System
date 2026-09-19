import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; feedbackId: string } }
) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const target = await prisma.feedback.findFirst({
      where: { id: BigInt(params.feedbackId), workerId: BigInt(params.id) },
    });
    if (!target) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await prisma.feedback.delete({ where: { id: target.id } });

    // Best-effort: apaga as fotos do Blob junto. Se falhar (arquivo já
    // sumiu, token indisponível etc.), a nota já foi apagada mesmo assim —
    // não vale travar a exclusão por causa de um anexo órfão.
    if (target.fotos.length > 0) {
      await del(target.fotos).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}