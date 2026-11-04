-- Duracao gravada no agendamento (o fim do atendimento deixa de depender do
-- servico atual). Aditiva: so acrescenta a coluna e preenche as existentes.
-- service_id e TEXT e appointment_services.id e UUID: dai o cast.
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER;

UPDATE "appointments" AS a
SET "duration_minutes" = s."duration_minutes"
FROM "appointment_services" AS s
WHERE a."service_id" = s."id"::text
  AND a."duration_minutes" IS NULL;
