-- Indices para as consultas mais comuns (melhoria 17).
--
-- orders: faturamento do mes no painel, relatorios e financeiro filtram por
-- empresa + periodo (e status 'paid'). A tabela nao tinha indice nenhum.
-- payment_transactions.order_id: a lista de cobrancas carrega as transacoes
-- de cada pedido (WHERE order_id IN (...)) e a FK usa o mesmo caminho.
-- audit_logs: relatorios e comissoes leem por empresa + periodo.
--
-- Sem CONCURRENTLY de proposito: as migrations sao aplicadas tanto por
-- `prisma migrate deploy` (que manda o arquivo inteiro de uma vez e nao aceita
-- CONCURRENTLY) quanto por prisma/apply-migrations.js. As tabelas sao
-- pequenas, entao o bloqueio de escrita dura milissegundos. Idempotente.
CREATE INDEX IF NOT EXISTS "orders_empresa_id_created_at_idx" ON "orders"("empresa_id", "created_at");
CREATE INDEX IF NOT EXISTS "orders_empresa_id_status_created_at_idx" ON "orders"("empresa_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "payment_transactions_order_id_idx" ON "payment_transactions"("order_id");
CREATE INDEX IF NOT EXISTS "audit_logs_empresa_id_created_at_idx" ON "audit_logs"("empresa_id", "created_at");
