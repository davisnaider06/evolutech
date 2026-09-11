-- Telefone da conta do cliente: so chave valida, e convertida de novo.
--
-- Duas coisas que a migration anterior (20260910180000) deixou para tras:
--
-- 1. Ela converteu para a chave o que estava gravado naquela hora, mas o
--    backend no ar ainda gravava "55 + DDD + numero" em conta nova. Conta
--    criada entre aquela migration e o deploy do codigo novo ficou no formato
--    antigo, que o login ja nao encontra. Converter de novo e seguro: a chave
--    e idempotente, valor ja convertido passa sem mudar.
--
-- 2. A chave aceitava qualquer coisa com digito. O login agora so procura
--    DDD + 8 digitos (10 no total); chave de outro tamanho e numero digitado
--    errado, que nunca mais vai casar com nada e so ocupa o indice unico.
--    Vira NULL — a conta continua entrando pelo email.
--
-- Chave que aparece em duas contas da mesma empresa tambem vira NULL, pelo
-- mesmo motivo da migration anterior: telefone ambiguo nao identifica ninguem.
--
-- Rodar DEPOIS do deploy do backend que grava a chave. Rodar antes tambem nao
-- quebra nada, so deixa de pegar conta criada no intervalo.
WITH digitos AS (
  SELECT
    "id",
    "empresa_id",
    regexp_replace("phone", '[^0-9]', '', 'g') AS d
  FROM "customer_accounts"
  WHERE "phone" IS NOT NULL
),
sem_pais AS (
  SELECT
    "id",
    "empresa_id",
    CASE
      WHEN length(d) >= 12 AND left(d, 2) = '55' THEN substring(d FROM 3)
      ELSE d
    END AS d
  FROM digitos
),
chaves AS (
  SELECT
    "id",
    "empresa_id",
    CASE
      WHEN length(d) = 11 AND substring(d FROM 3 FOR 1) = '9'
        THEN left(d, 2) || substring(d FROM 4)
      ELSE d
    END AS chave
  FROM sem_pais
),
resolvidas AS (
  SELECT
    c."id",
    CASE
      WHEN length(c.chave) = 10
        AND (
          SELECT count(*)
          FROM chaves x
          WHERE x."empresa_id" = c."empresa_id" AND x.chave = c.chave
        ) = 1
      THEN c.chave
      ELSE NULL
    END AS phone
  FROM chaves c
)
UPDATE "customer_accounts" ca
SET "phone" = r."phone"
FROM resolvidas r
WHERE ca."id" = r."id"
  AND ca."phone" IS DISTINCT FROM r."phone";
