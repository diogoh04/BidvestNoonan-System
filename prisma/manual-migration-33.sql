-- Rode este script UMA VEZ no SQL editor do Neon (depois do 32).
-- Feature: anexar fotos numa nota de staff (Feedback). Guarda as URLs
-- (Vercel Blob) direto na linha da nota, mesmo padrão de leave_reasons.
-- Ver Feedback.fotos no schema.prisma e POST /api/upload.

BEGIN;

ALTER TABLE "feedback" ADD COLUMN "fotos" TEXT[] NOT NULL DEFAULT '{}';

COMMIT;
