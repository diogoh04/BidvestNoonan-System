-- Rode este script UMA VEZ no SQL editor do Neon (depois do 22).
-- Feature: edição do nome do prédio/WO por linha (e do nome em negrito do
-- topo) direto na folha impressa (/timesheets/[id], /timesheets/leader/[id]
-- e no editor combinado) — sem NUNCA alterar predios/team/timesheet.
-- Aditivo: só cria uma tabela nova, não toca em nada existente.

BEGIN;

CREATE TABLE "timesheet_sheet_override" (
  "id" BIGSERIAL PRIMARY KEY,
  "subject_type" VARCHAR(20) NOT NULL,
  "subject_id" BIGINT NOT NULL,
  "scope" VARCHAR(50) NOT NULL,
  "nome_predio" VARCHAR(255),
  "work_order" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "timesheet_sheet_override_subject_type_subject_id_scope_key"
    UNIQUE ("subject_type", "subject_id", "scope")
);

COMMIT;
