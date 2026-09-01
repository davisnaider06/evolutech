-- Horario de funcionamento da barbearia, editavel pelo dono.
--
-- Estava fixo em config/agenda.ts: mudar o horario da casa exigia deploy, o
-- que e absurdo para uma informacao que o dono muda sozinho.
--
-- Guarda texto "HH:MM" e nao minutos: e o que o <input type="time"> manda e
-- devolve, entao nao ha conversao para errar entre a tela e o banco. Quem
-- converte para minuto e quem faz conta, na hora de montar a agenda.
--
-- NULL nos dois de proposito: significa "vale o padrao da casa" (9h30-21h em
-- config/agenda.ts). Empresa que nunca configurou continua funcionando, e
-- barbearia nova nasce com um horario razoavel sem precisar cadastrar nada.
--
-- Os dois andam juntos: so faz sentido ter inicio com fim. A validacao de que
-- o fim e depois do inicio fica no service, que sabe devolver erro legivel.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "agenda_start_time" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "agenda_end_time"   TEXT;
