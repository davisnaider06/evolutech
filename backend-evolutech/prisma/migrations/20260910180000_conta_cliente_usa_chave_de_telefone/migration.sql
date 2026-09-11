-- A conta do cliente passa a identificar pelo mesmo telefone que o resto do
-- sistema.
--
-- A migration anterior gravou o telefone como "55 + DDD + numero". Em paralelo
-- entrou utils/telefone.util, que identifica cliente por outra chave: sem
-- codigo do pais e sem o nono digito, porque "(31) 99876-5432" e
-- "(31) 9876-5432" sao a mesma linha. Duas regras conviverem significaria a
-- mesma pessoa ser uma no agendamento e outra na assinatura — que e
-- exatamente o que o portal existe para evitar.
--
-- Converte o que ja esta gravado. A chave e idempotente: valor ja convertido
-- passa por aqui sem mudar.
--
-- Chave que aparece em duas contas da mesma empresa vira NULL: telefone
-- ambiguo nao identifica ninguem, entao e melhor nao servir para entrar do que
-- servir para entrar na conta errada. O dono resolve o cadastro duplicado e o
-- cliente refaz o acesso.
WITH digitos AS (
  SELECT
    "id",
    "empresa_id",
    regexp_replace("phone", '\D', '', 'g') AS d
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
      WHEN c.chave <> ''
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
WHERE ca."id" = r."id";
