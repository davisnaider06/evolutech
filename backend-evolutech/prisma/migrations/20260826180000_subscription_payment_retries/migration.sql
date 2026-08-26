-- Janela de tentativas antes de cancelar por falha de pagamento.
-- Cartao recusado num dia (sem limite, antifraude, cartao vencido) nao deve
-- custar o cliente: o sistema tenta de novo por alguns dias e so cancela
-- depois de esgotar as tentativas.
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "payment_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "last_payment_attempt_at" TIMESTAMP(3);
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "grace_until" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "customer_subscriptions_grace_until_idx" ON "customer_subscriptions"("grace_until");
