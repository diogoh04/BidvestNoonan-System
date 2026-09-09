import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";
import { toJSONSafe } from "@/lib/types";
import { userNameInclude } from "@/lib/userName";
import { mapUser } from "@/lib/userDto";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const found = await prisma.user.findUnique({
    where: { id: BigInt(params.id) },
    include: userNameInclude,
  });
  if (!found) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(toJSONSafe(mapUser(found)));
}

// PATCH em vez de DELETE — desativar preserva o histórico de quem
// lançou/revisou cada folha de ponto (submittedByUser/reviewedByUser).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const userId = BigInt(params.id);

  const updateData: Record<string, unknown> = {};
  if (data.username !== undefined) updateData.username = data.username;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.role !== undefined) {
    updateData.teamId = data.role === "team_leader" && data.teamId ? BigInt(data.teamId) : null;
  } else if (data.teamId !== undefined) {
    updateData.teamId = data.teamId ? BigInt(data.teamId) : null;
  }
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: userNameInclude,
  });

  return NextResponse.json(toJSONSafe(mapUser(updated)));
}

// Diferente do PATCH acima (usado pra desativar): aqui é exclusão de fato,
// só pedida explicitamente pelo Master quando quer remover a conta mesmo.
// As folhas de ponto continuam existindo — createdByUserId/submittedByUserId/
// reviewedByUserId em Timesheet vão a null (onDelete: SetNull no schema).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const userId = BigInt(params.id);
  if (user!.userId === userId.toString()) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const found = await prisma.user.findUnique({ where: { id: userId } });
  if (!found) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
