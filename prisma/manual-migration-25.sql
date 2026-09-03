-- Rode este script UMA VEZ no SQL editor do Neon (depois do 24).
-- Feature: ordem dos prédios dentro de um time (reordenar em /teams/[id]),
-- refletida na sequência em que aparecem na folha impressa. Aditivo: só
-- adiciona uma coluna nova, com default 0 (ninguém muda de ordem até
-- alguém reordenar).

BEGIN;

ALTER TABLE "predios" ADD COLUMN "team_order" INTEGER NOT NULL DEFAULT 0;

COMMIT;
