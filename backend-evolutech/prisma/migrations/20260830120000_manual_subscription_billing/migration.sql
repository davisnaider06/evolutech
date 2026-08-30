-- Mensalidade cobrada na mao, sem gateway.
--
-- Ate aqui a regua so sabia dois finais no vencimento: cobrar no cartao pelo
-- gateway, ou conferir se o PIX foi confirmado pelo webhook. Barbearia que
-- nao conecta conta bancaria caia sempre no segundo caso, nunca via um
-- pagamento chegar, e tinha a assinatura CANCELADA automaticamente.
--
-- Agora existe um terceiro final: vence, entra em "overdue" e fica esperando
-- o dono dizer se recebeu ou nao. Quem decide e ele, nao o job.

-- 'overdue' = venceu e aguarda o dono confirmar o recebimento.
-- ADD VALUE nao pode ser usado na mesma transacao em que e criado, por isso
-- esta migracao so cria o valor; quem usa e o codigo, depois.
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'overdue';

-- Telefone que recebe o resumo diario de quem precisa pagar.
-- O sistema nao guardava telefone nenhum da empresa: o dono tem e-mail (na
-- conta de usuario) mas nao tinha por onde receber WhatsApp.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "notification_phone" TEXT;

-- Quando o resumo do dia foi enviado ao dono, para nao repetir a cada volta
-- do job (que roda de 6 em 6 horas).
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "billing_digest_sent_at" TIMESTAMP(3);

-- Quando a assinatura entrou em atraso, para a tela mostrar "vencida ha X dias"
-- e para o resumo ordenar pelas mais antigas.
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "overdue_since" TIMESTAMP(3);

-- Quando o dono confirmou o recebimento na mao, e quem confirmou.
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "manually_paid_at" TIMESTAMP(3);
ALTER TABLE "customer_subscriptions" ADD COLUMN IF NOT EXISTS "manually_paid_by" TEXT;

CREATE INDEX IF NOT EXISTS "customer_subscriptions_company_overdue_idx"
  ON "customer_subscriptions"("empresa_id", "status", "overdue_since");
