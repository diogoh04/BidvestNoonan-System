-- Rode este script UMA VEZ no SQL editor do Neon.
-- Feature: a folha quinzenal (biweekly) vira uma previsão que, ao ser
-- "lançada" pelo Team Leader, gera as duas folhas semanais reais que seguem
-- o fluxo normal de submit/review. Aditivo, não toca nenhuma linha existente:
--   1) timesheet.submitted_snapshot: foto do entries no 1º envio (draft ->
--      submitted) — baseline pra detectar "ajustes" feitos depois.
--   2) fortnight_plan: histórico do que foi lançado (as 10 colunas
--      originais) + link pras duas folhas semanais reais geradas.
--   3) adjustment: antes/depois + diff de uma edição feita numa folha
--      semanal depois do primeiro envio — um registro por folha.

BEGIN;

ALTER TABLE "timesheet" ADD COLUMN "submitted_snapshot" JSONB;

CREATE TABLE "fortnight_plan" (
  "id" BIGSERIAL PRIMARY KEY,
  "building_id" BIGINT NOT NULL REFERENCES "predios"("id") ON DELETE CASCADE,
  "fortnight_start" DATE NOT NULL,
  "forecast_entries" JSONB NOT NULL,
  "week1_timesheet_id" BIGINT NOT NULL UNIQUE REFERENCES "timesheet"("id") ON DELETE CASCADE,
  "week2_timesheet_id" BIGINT NOT NULL UNIQUE REFERENCES "timesheet"("id") ON DELETE CASCADE,
  "launched_by_user_id" BIGINT REFERENCES "app_user"("id") ON DELETE SET NULL,
  "launched_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "fortnight_plan_building_id_fortnight_start_key" UNIQUE ("building_id", "fortnight_start")
);

CREATE TABLE "adjustment" (
  "id" BIGSERIAL PRIMARY KEY,
  "timesheet_id" BIGINT NOT NULL UNIQUE REFERENCES "timesheet"("id") ON DELETE CASCADE,
  "before_entries" JSONB NOT NULL,
  "after_entries" JSONB NOT NULL,
  "diff" JSONB NOT NULL,
  "updated_by_user_id" BIGINT REFERENCES "app_user"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);

COMMIT;
