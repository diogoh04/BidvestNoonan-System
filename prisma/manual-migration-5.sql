-- Rode este script UMA VEZ no SQL editor do Neon.
-- Permite horas decimais (ex.: 7.5 = 7h30) em todo lugar que hoje só
-- aceita número inteiro.

BEGIN;

ALTER TABLE "worker" ALTER COLUMN "horas_semana" TYPE double precision USING "horas_semana"::double precision;
ALTER TABLE "predios" ALTER COLUMN "horas_disponiveis" TYPE double precision USING "horas_disponiveis"::double precision;
ALTER TABLE "building_slot" ALTER COLUMN "horas" TYPE double precision USING "horas"::double precision;
ALTER TABLE "staff_building" ALTER COLUMN "horas" TYPE double precision USING "horas"::double precision;
ALTER TABLE "building_cover" ALTER COLUMN "horas" TYPE double precision USING "horas"::double precision;

COMMIT;
