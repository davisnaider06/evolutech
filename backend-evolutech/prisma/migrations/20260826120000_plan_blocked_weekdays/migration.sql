-- Dias da semana em que o plano de mensalidade nao vale (0=domingo ... 6=sabado).
-- Vazio = cobre a semana inteira, preservando o comportamento dos planos existentes.
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "blocked_weekdays" INTEGER[] NOT NULL DEFAULT '{}';
