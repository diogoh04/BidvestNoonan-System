-- Rode este script UMA VEZ no SQL editor do Neon.
-- Cria a tabela de "covers" avulsos da folha de ponto: staff cobrindo um
-- prédio por um dia, sem criar vínculo real (staff_building) com o prédio.

BEGIN;

CREATE TABLE IF NOT EXISTS "building_cover" (
  "id"           bigserial PRIMARY KEY,
  "building_id"  bigint NOT NULL REFERENCES "predios"("id") ON DELETE CASCADE,
  "nome"         varchar(255),
  "staff_number" varchar(255),
  "horas"        integer,
  "created_at"   timestamp DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
