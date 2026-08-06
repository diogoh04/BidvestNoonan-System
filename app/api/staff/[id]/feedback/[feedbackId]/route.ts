import { NextRequest, NextResponse } from "next/server";
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
    const result = await prisma.feedback.deleteMany({
      where: { id: BigInt(params.feedbackId), workerId: BigInt(params.id) },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}