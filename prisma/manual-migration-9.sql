-- Rode este script UMA VEZ no SQL editor do Neon.
-- Exclusão de folha de ponto vira "mover pra lixeira": em vez de apagar a
-- linha (DELETE), marca deleted_at/deleted_by_user_id. A folha some das
-- telas normais mas fica guardada, dando pra restaurar em /review/excluidas
-- caso alguém exclua sem querer.

BEGIN;

ALTER TABLE "timesheet"
  ADD COLUMN "deleted_at" TIMESTAMPTZ,
  ADD COLUMN "deleted_by_user_id" BIGINT;

ALTER TABLE "timesheet"
  ADD CONSTRAINT "timesheet_deleted_by_user_id_fkey"
  FOREIGN KEY ("deleted_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL;

CREATE INDEX "timesheet_deleted_at_idx" ON "timesheet" ("deleted_at");

COMMIT;

