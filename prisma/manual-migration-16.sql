-- Rode este script UMA VEZ no SQL editor do Neon (depois do manual-migration-15.sql).
-- Feature: /hours-control — Building.horas_disponiveis (UCD Hours) já existe
-- e é o orçamento semanal; esta tabela guarda o que foi de fato gasto,
-- lançado semana a semana pelo Master, pra dar pra calcular o balanço
-- (orçado - gasto). Aditivo, não toca nada existente.

BEGIN;

CREATE TABLE "building_hours_log" (
  "id" BIGSERIAL PRIMARY KEY,
  "building_id" BIGINT NOT NULL REFERENCES "predios"("id") ON DELETE CASCADE,
  "week_start" DATE NOT NULL,
  "hours_spent" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "building_hours_log_building_id_week_start_key" UNIQUE ("building_id", "week_start")
);

COMMIT;
