-- Migration 32: conta de acesso "team_leader" passa a apontar pro TIME.
--
-- Antes: User.staff_id -> Staff (a pessoa). O portal do TL descobria os
-- prédios via StaffBuilding role='team_leader'.
-- Agora: User.team_id -> Team. Os prédios/permissões vêm de Building.team_id,
-- e o nome exibido vem da(s) conexão(ões) TeamLeader do time.
--
-- `staff_id` fica na tabela (contas antigas), só não é mais preenchido.
--
-- Rodar no Neon (DIRECT_URL) depois da migration 31.

BEGIN;

ALTER TABLE "app_user"
  ADD COLUMN "team_id" BIGINT REFERENCES "team"("id") ON DELETE SET NULL;

CREATE INDEX "app_user_team_id_idx" ON "app_user" ("team_id");

-- Best-effort: contas team_leader existentes -> liga no time que a pessoa
-- lidera hoje (se ela lidera exatamente um). As demais o Master religa na mão.
UPDATE "app_user" u
SET "team_id" = tl."team_id"
FROM "team_leader" tl
WHERE u."role" = 'team_leader'
  AND u."staff_id" = tl."staff_id"
  AND (SELECT count(*) FROM "team_leader" x WHERE x."staff_id" = u."staff_id") = 1;

COMMIT;
