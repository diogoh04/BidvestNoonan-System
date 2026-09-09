-- Migration 30: Adjustment vira LOG (vários por folha) + status/review próprios.
--
-- Contexto: o fluxo quinzenal do Team Leader passa a ser "enviar ao supervisor"
-- direto (sem Launch/folhas semanais), e cada edição feita DEPOIS do 1º envio
-- vira um registro novo nesta tabela (append-only), revisado individualmente
-- pelo supervisor ("Mark adjustment as done"). Antes era 1 linha por folha
-- (upsert), sempre refletindo o diff atual.
--
-- Rodar no Neon (DIRECT_URL) depois da migration 29.

BEGIN;

-- Deixa de ser 1-por-folha.
ALTER TABLE "adjustment" DROP CONSTRAINT "adjustment_timesheet_id_key";

-- Ciclo de revisão de cada ajuste (independente do status da própria folha).
ALTER TABLE "adjustment" ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE "adjustment" ADD COLUMN "reviewed_by_user_id" BIGINT;
ALTER TABLE "adjustment" ADD COLUMN "reviewed_at" TIMESTAMP(3);

ALTER TABLE "adjustment"
  ADD CONSTRAINT "adjustment_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "app_user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Busca "os ajustes desta folha" agora é comum.
CREATE INDEX "adjustment_timesheet_id_idx" ON "adjustment" ("timesheet_id");

COMMIT;
