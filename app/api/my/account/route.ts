import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { passwordSchema } from "@/lib/validation";
import { toJSONSafe } from "@/lib/types";

const selfPasswordSchema = z.object({ password: passwordSchema });

// Conta do próprio usuário logado — cada um só enxerga/mexe na sua, nunca
// em id vindo do cliente (diferente de /api/users/[id], que é exclusivo do Master).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const found = await prisma.user.findUnique({
    where: { id: BigInt(user.userId) },
    include: { staff: true },
  });
  if (!found) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  return NextResponse.json(
    toJSONSafe({ username: found.username, nome: found.staff?.nome ?? null })
  );
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = selfPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: BigInt(user.userId) },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
