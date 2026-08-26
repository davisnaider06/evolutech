-- Vinculo real entre a mensalidade e o pedido que a cobra.
-- Antes esse vinculo existia apenas como texto em "notes", entao o webhook
-- do gateway confirmava o pagamento sem nunca ativar a assinatura.
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "order_id" TEXT;
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "renewal_notice_sent_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_subscriptions_order_id_key" ON "customer_subscriptions"("order_id");
CREATE INDEX IF NOT EXISTS "customer_subscriptions_status_end_at_idx" ON "customer_subscriptions"("status", "end_at");

DO $$ BEGIN
    ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Recupera o vinculo das assinaturas antigas, que guardavam o pedido
-- no formato "order_id:<uuid>" dentro do campo de observacoes.
UPDATE "customer_subscriptions" s
SET "order_id" = substring(s."notes" from 'order_id:([0-9a-fA-F-]{36})')
WHERE s."order_id" IS NULL
  AND s."notes" LIKE 'order_id:%'
  AND EXISTS (
    SELECT 1 FROM "orders" o
    WHERE o."id" = substring(s."notes" from 'order_id:([0-9a-fA-F-]{36})')
  );
