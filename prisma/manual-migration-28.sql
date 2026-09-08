-- Rode este script UMA VEZ no SQL editor do Neon (depois do 27).
-- Feature: ordem manual dos nomes na folha de ponto (Sign In & Sign Out Book),
-- definida por prédio na página /buildings/[id] — ver StaffBuilding.ordem no
-- schema.prisma e lib/timesheetRows.ts.
--
-- Aditivo: coluna nova nullable, não toca em nenhuma linha existente. NULL em
-- todos os vínculos cleaner de um prédio = ordem automática por horas (o
-- comportamento de hoje).

BEGIN;

ALTER TABLE "staff_building" ADD COLUMN "ordem" INTEGER;

COMMIT;
