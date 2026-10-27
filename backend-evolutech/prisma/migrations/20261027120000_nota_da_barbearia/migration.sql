-- Nota da barbearia, separada da nota do barbeiro.
--
-- Ate aqui a avaliacao era uma so, presa ao barbeiro. O cliente que gostou do
-- corte mas esperou 40 minutos na recepcao nao tinha onde dizer isso, e a
-- espera acabava derrubando a nota de quem cortou. Agora sao duas: o corte
-- (rating, do barbeiro) e a casa (rating_empresa: ambiente, atendimento,
-- pontualidade).
--
-- Opcional: as avaliacoes feitas antes desta coluna ficam sem nota da casa e
-- nao entram na media dela.
ALTER TABLE "appointment_reviews" ADD COLUMN IF NOT EXISTS "rating_empresa" INTEGER;

ALTER TABLE "appointment_reviews"
  DROP CONSTRAINT IF EXISTS "appointment_reviews_rating_empresa_check";
ALTER TABLE "appointment_reviews"
  ADD CONSTRAINT "appointment_reviews_rating_empresa_check"
  CHECK ("rating_empresa" IS NULL OR "rating_empresa" BETWEEN 1 AND 5);
