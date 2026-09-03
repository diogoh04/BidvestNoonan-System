-- Rode este script UMA VEZ no SQL editor do Neon (depois do 23).
-- Feature: Sign In/Sign Out digitados na folha impressa por prédio
-- (/timesheets/[id]) ficam salvos. Aditivo: só cria uma tabela nova, não
-- toca em nada existente.

BEGIN;

CREATE TABLE "timesheet_sheet_sign" (
  "id" BIGSERIAL PRIMARY KEY,
  "subject_type" VARCHAR(20) NOT NULL,
  "subject_id" BIGINT NOT NULL,
  "scope" VARCHAR(50) NOT NULL,
  "sign_in" VARCHAR(20),
  "sign_out" VARCHAR(20),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "timesheet_sheet_sign_subject_type_subject_id_scope_key"
    UNIQUE ("subject_type", "subject_id", "scope")
);

COMMIT;
