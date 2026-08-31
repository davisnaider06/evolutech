-- Aparelhos inscritos para receber notificacao push.
--
-- O sistema so sabia avisar por e-mail, e e-mail o dono da barbearia nao le
-- durante o expediente. Push chega no celular na hora, que e onde ele esta.
--
-- A inscricao e por aparelho, nao por pessoa: quem usa o app no celular e no
-- computador gera duas linhas e precisa receber nas duas. Dai o UNIQUE em
-- `endpoint`, que e o identificador que o proprio navegador emite.
--
-- `company_id` e opcional de proposito: quem e SUPER_ADMIN_EVOLUTECH nao tem
-- empresa, e a coluna serve para filtrar avisos de uma barbearia especifica.
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"           TEXT NOT NULL,
  "user_id"      TEXT NOT NULL,
  "company_id"   TEXT,
  "endpoint"     TEXT NOT NULL,
  "p256dh"       TEXT NOT NULL,
  "auth"         TEXT NOT NULL,
  "user_agent"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "push_subscriptions_company_id_idx" ON "push_subscriptions"("company_id");

-- Aparelho segue o dono: conta apagada leva as inscricoes junto.
ALTER TABLE "push_subscriptions"
  DROP CONSTRAINT IF EXISTS "push_subscriptions_user_id_fkey";
ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
