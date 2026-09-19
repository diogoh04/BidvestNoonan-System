import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";

// GET ?pathname=feedback/xxx.png -> stream do blob privado. Como o store é
// privado (ver POST /api/upload), o browser não consegue buscar a URL do
// blob direto — tem que passar por aqui, autenticado. Não checa dono
// específico da foto (mistura master/team_leader vendo notas de vários
// times) — mesmo nível de acesso já aplicado ao resto de Feedback (ver
// authorize() em app/api/staff/[id]/feedback/route.ts), só exige sessão.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const pathname = req.nextUrl.searchParams.get("pathname");
  if (!pathname || !pathname.startsWith("feedback/")) {
    return NextResponse.json({ error: "Invalid pathname" }, { status: 400 });
  }

  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
    },
  });
}
