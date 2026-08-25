-- Gap 15/9: barbeiro de referencia do cliente + rastreio de visita e inativacao
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferred_professional_id" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_visit_at" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMP(3);

-- Gap 20: mensalista vinculado a um barbeiro
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "professional_id" TEXT;

-- Gap 11a: ajuste de comissao por dia
ALTER TABLE "commission_adjustments" ADD COLUMN IF NOT EXISTS "ref_date" DATE;

-- Gap 13: bloqueio pontual de agenda
CREATE TABLE IF NOT EXISTS "appointment_blocks" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "professional_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "weekday" INTEGER,
    "start_time" TEXT,
    "end_time" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointment_blocks_pkey" PRIMARY KEY ("id")
);

-- Indices
CREATE INDEX IF NOT EXISTS "customers_empresa_id_preferred_professional_id_idx" ON "customers"("empresa_id", "preferred_professional_id");
CREATE INDEX IF NOT EXISTS "customers_empresa_id_is_active_last_visit_at_idx" ON "customers"("empresa_id", "is_active", "last_visit_at");
CREATE INDEX IF NOT EXISTS "customer_subscriptions_empresa_id_professional_id_status_idx" ON "customer_subscriptions"("empresa_id", "professional_id", "status");
CREATE INDEX IF NOT EXISTS "commission_adjustments_empresa_id_professional_id_ref_date_idx" ON "commission_adjustments"("empresa_id", "professional_id", "ref_date");
CREATE INDEX IF NOT EXISTS "appointment_blocks_empresa_id_professional_id_start_at_idx" ON "appointment_blocks"("empresa_id", "professional_id", "start_at");
CREATE INDEX IF NOT EXISTS "appointment_blocks_empresa_id_professional_id_weekday_idx" ON "appointment_blocks"("empresa_id", "professional_id", "weekday");

-- Chaves estrangeiras.
-- SetNull no barbeiro: se ele sair da barbearia, o cliente e a mensalidade continuam existindo.
DO $$ BEGIN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_preferred_professional_id_fkey"
        FOREIGN KEY ("preferred_professional_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_professional_id_fkey"
        FOREIGN KEY ("professional_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "appointment_blocks" ADD CONSTRAINT "appointment_blocks_empresa_id_fkey"
        FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "appointment_blocks" ADD CONSTRAINT "appointment_blocks_professional_id_fkey"
        FOREIGN KEY ("professional_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: ultima visita a partir do historico de atendimento ja existente.
UPDATE "customers" c
SET "last_visit_at" = sub."ultima"
FROM (
    SELECT "customer_id", MAX("service_date") AS "ultima"
    FROM "customer_service_history_entries"
    GROUP BY "customer_id"
) sub
WHERE c."id" = sub."customer_id" AND c."last_visit_at" IS NULL;

-- Backfill: barbeiro de referencia = quem mais atendeu o cliente.
UPDATE "customers" c
SET "preferred_professional_id" = sub."professional_id"
FROM (
    SELECT DISTINCT ON ("customer_id") "customer_id", "professional_id"
    FROM "appointments"
    WHERE "customer_id" IS NOT NULL AND "professional_id" IS NOT NULL
    GROUP BY "customer_id", "professional_id"
    ORDER BY "customer_id", COUNT(*) DESC
) sub
WHERE c."id" = sub."customer_id" AND c."preferred_professional_id" IS NULL;
