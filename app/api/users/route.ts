import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { userInputSchema } from "@/lib/validation";
import { toJSONSafe, UserDTO } from "@/lib/types";

function mapUser(u: any): UserDTO {
  return {
    id: u.id.toString(),
    username: u.username,
    role: u.role,
    active: u.active,
    staffId: u.staffId ? u.staffId.toString() : null,
    staffNome: u.staff?.nome ?? null,
    createdAt: u.createdAt ? u.createdAt.toISOString() : null,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: { staff: true },
    orderBy: { username: "asc" },
  });

  return NextResponse.json(toJSONSafe(users.map(mapUser)));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, "master")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = userInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (!data.password) {
    return NextResponse.json({ error: "Senha é obrigatória na criação" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) {
    return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const created = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash,
      role: data.role,
      staffId: data.role === "team_leader" && data.staffId ? BigInt(data.staffId) : null,
      active: data.active ?? true,
    },
    include: { staff: true },
  });

  return NextResponse.json(toJSONSafe(mapUser(created)), { status: 201 });
}
