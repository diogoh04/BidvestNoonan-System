-- Rode este script UMA VEZ no SQL editor do Neon (depois do 26).
-- Feature: permitir o mesmo staff vinculado como "cleaner" MAIS DE UMA VEZ
-- no mesmo prédio (ex.: dois turnos/postos, cada um com suas horas) — ver
-- StaffForm ("Buildings (as cleaner)") e schema.prisma:StaffBuilding.
--
-- Troca a PK composta [staff_id, building_id, role] por uma chave sintética
-- `id`. O vínculo "team_leader" continua no máximo um por staff+prédio,
-- agora garantido por um índice único PARCIAL (só quando role = 'team_leader')
-- — todo o código de times depende disso.

BEGIN;

ALTER TABLE "staff_building" DROP CONSTRAINT "staff_building_pkey";

ALTER TABLE "staff_building" ADD COLUMN "id" BIGSERIAL PRIMARY KEY;

CREATE UNIQUE INDEX IF NOT EXISTS "staff_building_team_leader_unique"
  ON "staff_building" ("staff_id", "building_id")
  WHERE "role" = 'team_leader';

CREATE INDEX IF NOT EXISTS "staff_building_staff_id_idx"
  ON "staff_building" ("staff_id");

CREATE INDEX IF NOT EXISTS "staff_building_building_id_idx"
  ON "staff_building" ("building_id");

COMMIT;
