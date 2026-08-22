-- Rode este script UMA VEZ no SQL editor do Neon (depois do 20).
-- Limpeza: remove 3 colunas legadas de "worker" que não são mais lidas nem
-- escritas por nenhuma rota da aplicação (confirmado por busca no código):
--   - role:   papel global do staff — substituído por staff_building.role
--             (papel por vínculo staff+prédio) há muito tempo.
--   - predios: FK direta pra um prédio "fixo" do staff — só era usada pra
--             zerar (SET NULL) quando um prédio era apagado; nunca era lida
--             nem escrita com um valor de verdade em nenhum fluxo atual.
--   - predio: coluna de texto livre, legado de antes do staff_building.
-- Isso é DESTRUTIVO — apaga o que estiver nessas colunas pra sempre. Se
-- alguma delas ainda guardar algo que importa, exporte antes de rodar.

BEGIN;

ALTER TABLE "worker" DROP COLUMN "role";
ALTER TABLE "worker" DROP COLUMN "predios";
ALTER TABLE "worker" DROP COLUMN "predio";

COMMIT;
