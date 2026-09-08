-- Rode este script UMA VEZ no SQL editor do Neon (depois do 28).
-- Feature: Building/WO da folha por PESSOA (por vínculo StaffBuilding), não
-- mais preso ao índice da linha (TimesheetSheetOverride escopo row:<i>).
-- Ver StaffBuilding.predioLabel / workOrder no schema.prisma e
-- lib/timesheetRows.ts.
--
-- Aditivo: 2 colunas nullable. NULL = usa Building.nome / Building.workOrder
-- (comportamento de hoje em todo prédio).
--
-- Também migra as 23 etiquetas que já existem na folha do prédio "Team
-- Leaders" (#72): cada override "row:N" vira dado do cleaner que está na
-- posição N hoje (a ordem manual == índice da folha nesse prédio agora).

BEGIN;

ALTER TABLE "staff_building" ADD COLUMN "predio_label" VARCHAR(255);
ALTER TABLE "staff_building" ADD COLUMN "work_order"   VARCHAR(255);

UPDATE "staff_building" sb
SET "predio_label" = NULLIF(o."nome_predio", ''),
    "work_order"   = NULLIF(NULLIF(o."work_order", ''), b."work_order")
FROM "timesheet_sheet_override" o
JOIN "predios" b ON b."id" = 72
WHERE o."subject_type" = 'building'
  AND o."subject_id" = 72
  AND sb."building_id" = 72
  AND sb."role" = 'cleaner'
  AND sb."ordem" IS NOT NULL
  AND o."scope" = 'row:' || sb."ordem";

DELETE FROM "timesheet_sheet_override"
WHERE "subject_type" = 'building'
  AND "subject_id" = 72
  AND "scope" LIKE 'row:%';

COMMIT;
