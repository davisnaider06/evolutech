-- Avaliacao do atendimento pelo cliente: 1 a 5 estrelas e comentario opcional.
--
-- Uma por agendamento (UNIQUE em appointment_id): o cliente avalia o corte que
-- fez, nao o barbeiro em geral, e nao da para inflar a nota repetindo.
--
-- professional_id e customer_id sao copiados do agendamento no momento da
-- avaliacao. Sem FK de proposito, como em appointment_notifications: barbeiro
-- ou cliente apagado nao leva a nota embora nem bloqueia a exclusao.
--
-- O anonimato e regra de leitura, nao de gravacao: o dono ve customer_id, o
-- barbeiro recebe so nota e comentario (ver review.service.ts).
CREATE TABLE IF NOT EXISTS "appointment_reviews" (
  "id"              TEXT NOT NULL,
  "empresa_id"      TEXT NOT NULL,
  "appointment_id"  TEXT NOT NULL,
  "professional_id" TEXT,
  "customer_id"     TEXT,
  "rating"          INTEGER NOT NULL,
  "comment"         TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointment_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_reviews_appointment_id_key"
  ON "appointment_reviews"("appointment_id");
CREATE INDEX IF NOT EXISTS "appointment_reviews_empresa_prof_created_idx"
  ON "appointment_reviews"("empresa_id", "professional_id", "created_at");

ALTER TABLE "appointment_reviews"
  DROP CONSTRAINT IF EXISTS "appointment_reviews_appointment_id_fkey";
ALTER TABLE "appointment_reviews"
  ADD CONSTRAINT "appointment_reviews_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
