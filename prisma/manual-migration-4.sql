-- Rode este script UMA VEZ no SQL editor do Neon.
-- Cria o status especial do staff (p45 / le / blocked) e migra os staff que
-- hoje estão "vinculados" aos prédios-placeholder P45 (id 80), LE (id 81) e
-- Visa Staff Blocked (id 82) para o novo campo — depois remove esses 3
-- prédios, que nunca foram prédios de verdade.

BEGIN;

ALTER TABLE "worker" ADD COLUMN IF NOT EXISTS "status" varchar(20);
ALTER TABLE "worker" ADD COLUMN IF NOT EXISTS "blocked_at" timestamp;

ALTER TABLE "worker"
  ADD CONSTRAINT "worker_status_check" CHECK ("status" IN ('p45', 'le', 'blocked'));

-- Backfill a partir dos vínculos existentes com os prédios-placeholder.
UPDATE "worker" SET "status" = 'p45'
WHERE "id" IN (SELECT "staff_id" FROM "staff_building" WHERE "building_id" = 80);

UPDATE "worker" SET "status" = 'le'
WHERE "id" IN (SELECT "staff_id" FROM "staff_building" WHERE "building_id" = 81);

UPDATE "worker" SET "status" = 'blocked'
WHERE "id" IN (SELECT "staff_id" FROM "staff_building" WHERE "building_id" = 82);

-- Remove os vínculos-tag e os 3 prédios-placeholder (nunca foram prédios reais).
DELETE FROM "staff_building" WHERE "building_id" IN (80, 81, 82);
DELETE FROM "building_slot" WHERE "building_id" IN (80, 81, 82);
DELETE FROM "building_cover" WHERE "building_id" IN (80, 81, 82);
DELETE FROM "predios" WHERE "id" IN (80, 81, 82);

COMMIT;
