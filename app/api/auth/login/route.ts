import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const password = body.password;

  if (!password || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
