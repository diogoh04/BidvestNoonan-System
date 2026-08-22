-- Rode este script UMA VEZ no SQL editor do Neon (depois do 21).
-- Feature: separa "UCD Hours" (horas que a faculdade/cliente libera pra
-- gente) de "Available Hours" (predios.horas_disponiveis, horas que a gente
-- de fato repassa pro team leader gerir) — até agora eram o mesmo campo
-- (horas_disponiveis fazia as duas pontas, ver comentário antigo no
-- schema.prisma). Aditivo: cria predios.ucd_hours e faz backfill com o
-- valor atual de horas_disponiveis (era o que já estava sendo tratado como
-- "UCD Hours" até agora, inclusive no snapshot de building_hours_log).
-- Depois deste script os dois campos passam a ser editados
-- independentemente em /buildings/[id] e /teams/[id].

BEGIN;

ALTER TABLE "predios" ADD COLUMN "ucd_hours" DOUBLE PRECISION;
UPDATE "predios" SET "ucd_hours" = "horas_disponiveis";

COMMIT;
