-- Rode este script UMA VEZ no SQL editor do Neon (depois do 25).
-- Feature: registrar no histórico do prédio alguém sem cadastro de Staff
-- (nome só, sem staff number) — ver BuildingStaffHistoryCard e POST
-- /api/staff-history. Aditivo: libera staff_id (era NOT NULL) e adiciona
-- duas colunas novas pro nome/número soltos; não toca nas linhas existentes.

BEGIN;

ALTER TABLE "staff_history" ALTER COLUMN "staff_id" DROP NOT NULL;
ALTER TABLE "staff_history" ADD COLUMN "staff_nome" VARCHAR(255);
ALTER TABLE "staff_history" ADD COLUMN "staff_number" VARCHAR(50);

COMMIT;
