-- Rode este script UMA VEZ no SQL editor do Neon, depois de já ter corrigido
-- os casos de "predio" divergentes (Gabriel -> Richview Hub, Taisy -> Newman).
-- Ele NÃO apaga nenhum dado de worker/predios/feedback, só adiciona estrutura nova
-- e remove o que já foi confirmado como legado (playing_with_neon, worker.feedback).

BEGIN;

-- 1) Papel do staff: cleaner (padrão) ou team_leader
ALTER TABLE "worker"
  ADD COLUMN IF NOT EXISTS "role" varchar(20) NOT NULL DEFAULT 'cleaner';

ALTER TABLE "worker"
  ADD CONSTRAINT "worker_role_check" CHECK ("role" IN ('cleaner', 'team_leader'));

-- 2) Vínculo N:N entre team leader e prédios
CREATE TABLE IF NOT EXISTS "staff_building" (
  "staff_id"    bigint NOT NULL REFERENCES "worker"("id") ON DELETE CASCADE,
  "building_id" bigint NOT NULL REFERENCES "predios"("id") ON DELETE CASCADE,
  "created_at"  timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("staff_id", "building_id")
);

-- 3) Colunas/tabelas legadas confirmadas como não usadas
ALTER TABLE "worker" DROP COLUMN IF EXISTS "feedback";
DROP TABLE IF EXISTS "playing_with_neon";

-- Observação: a coluna "worker"."predio" (texto livre) fica intocada de propósito.
-- A aplicação não usa mais ela (usa "predios", o FK). Apague manualmente quando
-- tiver certeza que não precisa mais dela:
-- ALTER TABLE "worker" DROP COLUMN "predio";

COMMIT;
