import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/session";
import { registerInputSchema } from "@/lib/validation";

// Autocadastro público — cria a conta como "pending" (sem papel definido)
// e já loga a pessoa, que cai em /pending até o Master aprovar em /users.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = registerInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { username, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { username, passwordHash, role: "pending", active: true },
  });

  const token = await createSessionToken({
    userId: user.id.toString(),
    role: "pending",
    staffId: null,
  });

  const res = NextResponse.json({ ok: true }, { status: 201 });
  res.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
