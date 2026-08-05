-- Rode este script UMA VEZ no SQL editor do Neon.
-- Permite que o mesmo staff seja team_leader E cleaner no MESMO prédio ao
-- mesmo tempo. Hoje a chave primária de staff_building é (staff_id,
-- building_id), então só cabe um vínculo por staff+prédio (um papel só).
-- Passa a ser (staff_id, building_id, role): dois vínculos no mesmo prédio
-- (um cleaner, um team_leader), cada um com suas próprias horas.
-- Não apaga nem move nenhum dado — os vínculos existentes já são únicos por
-- staff+prédio, então continuam válidos sob a chave nova (que é um
-- superconjunto da antiga).

BEGIN;

ALTER TABLE "staff_building" DROP CONSTRAINT "staff_building_pkey";
ALTER TABLE "staff_building" ADD CONSTRAINT "staff_building_pkey" PRIMARY KEY ("staff_id", "building_id", "role");

COMMIT;
