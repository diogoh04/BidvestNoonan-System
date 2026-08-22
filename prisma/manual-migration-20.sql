-- Rode este script UMA VEZ no SQL editor do Neon (depois do 19).
-- Feature: UCD Hours passa a ser "congelado" por semana em /hours-control —
-- ver comentário do model BuildingHoursLog no schema.prisma. Aditivo.

BEGIN;

ALTER TABLE "building_hours_log" ADD COLUMN "ucd_hours" DOUBLE PRECISION;

-- Backfill aproximado: as semanas já lançadas antes dessa feature não têm
-- captura do UCD Hours da época, então usamos o valor atual do prédio como
-- melhor estimativa disponível. Dali pra frente (após este script), cada
-- semana nova captura o valor de verdade no momento do primeiro lançamento.
UPDATE "building_hours_log" bhl
SET "ucd_hours" = p."horas_disponiveis"
FROM "predios" p
WHERE p."id" = bhl."building_id" AND bhl."ucd_hours" IS NULL;

COMMIT;
