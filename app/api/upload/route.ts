import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// POST multipart/form-data { file } -> { pathname }. Upload genérico pro
// Vercel Blob (precisa da env BLOB_READ_WRITE_TOKEN — ver .env.example).
// Hoje só usado pelas fotos anexadas numa nota de staff (ver
// Feedback.fotos), mas não é específico disso de propósito — dá pra
// reaproveitar em outro anexo futuro sem precisar de outro endpoint.
//
// access: "private" porque o store é privado (padrão atual da Vercel pra
// stores novos) — a URL direta do blob não é acessível sem token, então o
// que devolvemos é só o `pathname`; quem quiser ver a imagem passa por
// GET /api/files?pathname=... (exige sessão logada, ver route.ts lá).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 8MB)" }, { status: 400 });
  }

  const blob = await put(`feedback/${file.name}`, file, {
    access: "private",
    addRandomSuffix: true,
  });

  return NextResponse.json({ pathname: blob.pathname }, { status: 201 });
}
