-- OPCIONAL — só rode se você quiser um "reset" de /teams.
--
-- O manual-migration-15.sql criou automaticamente um Team pra cada team
-- leader que já existia (backfill), o que faz /teams começar cheio de times
-- que você não criou pela tela nova — confuso se a ideia é montar os times
-- do zero usando "New team" + conectar prédios/líder manualmente.
--
-- Este script apaga TODOS os times (tabela "team") e, por causa do
-- ON DELETE SET NULL, desaloca automaticamente todos os prédios (predios.
-- team_id volta a NULL). NÃO mexe no vínculo legado staff_building
-- role='team_leader' (isso é doutro sistema — o portal de autoatendimento
-- do Team Leader — e continua intacto e funcionando).
--
-- Depois de rodar, /teams fica vazio e todo prédio aparece em "not allocated
-- to any team" em /hours-control, pronto pra você recadastrar do seu jeito.

BEGIN;

DELETE FROM "team";

COMMIT;
