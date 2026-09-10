-- Cliente entra por email OU telefone.
--
-- A conta do portal so existia com email. Quem tem cliente que nao usa email
-- (a maioria, na barbearia) ficava sem conta e, sem conta, sem assinatura no
-- nome dele. Telefone vira o segundo identificador: no cadastro exige-se um
-- dos dois, e no login vale qualquer um.
--
-- Email deixa de ser NOT NULL pelo mesmo motivo: agora e opcional desde que
-- haja telefone. A regra de "pelo menos um" fica no service, que sabe recusar
-- com mensagem legivel; o banco cuida apenas de nao repetir identificador
-- dentro da mesma empresa.
ALTER TABLE "customer_accounts" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "customer_accounts" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Contas que ja existem herdam o telefone do cliente, normalizado (so digitos,
-- com o 55 na frente) — mesma regra do WhatsApp, para o numero que serve la
-- servir aqui. Assim o cliente antigo tambem passa a poder entrar pelo
-- telefone, sem recadastro.
--
-- So entra telefone que identifica uma conta sozinho: se duas contas da mesma
-- empresa apontam para o mesmo numero, nenhuma das duas recebe — telefone
-- ambiguo nao identifica ninguem, e o dono resolve o cadastro duplicado antes.
WITH normalizado AS (
  SELECT
    ca."id",
    ca."empresa_id",
    CASE
      WHEN length(regexp_replace(c."phone", '\D', '', 'g')) IN (10, 11)
        THEN '55' || regexp_replace(c."phone", '\D', '', 'g')
      WHEN length(regexp_replace(c."phone", '\D', '', 'g')) IN (12, 13)
        THEN regexp_replace(c."phone", '\D', '', 'g')
      ELSE NULL
    END AS phone
  FROM "customer_accounts" ca
  JOIN "customers" c ON c."id" = ca."customer_id"
  WHERE c."phone" IS NOT NULL
),
unicos AS (
  SELECT n."id", n."phone"
  FROM normalizado n
  WHERE n."phone" IS NOT NULL
    AND (
      SELECT count(*)
      FROM normalizado x
      WHERE x."empresa_id" = n."empresa_id" AND x."phone" = n."phone"
    ) = 1
)
UPDATE "customer_accounts" ca
SET "phone" = u."phone"
FROM unicos u
WHERE ca."id" = u."id";

-- Um telefone, uma conta, dentro da empresa. NULL repete a vontade (Postgres
-- trata cada NULL como distinto), que e o caso de quem so tem email.
CREATE UNIQUE INDEX IF NOT EXISTS "customer_accounts_empresa_id_phone_key"
  ON "customer_accounts" ("empresa_id", "phone");
