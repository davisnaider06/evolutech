CREATE TABLE "support_tickets" (
  "id" TEXT NOT NULL,
  "empresa_id" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "responded_by_user_id" TEXT,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "prioridade" TEXT NOT NULL DEFAULT 'media',
  "status" TEXT NOT NULL DEFAULT 'aberto',
  "categoria" TEXT,
  "resposta" TEXT,
  "responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_empresa_id_status_idx" ON "support_tickets"("empresa_id", "status");
CREATE INDEX "support_tickets_created_by_user_id_idx" ON "support_tickets"("created_by_user_id");
CREATE INDEX "support_tickets_responded_by_user_id_idx" ON "support_tickets"("responded_by_user_id");

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_empresa_id_fkey"
FOREIGN KEY ("empresa_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_tickets"
ADD CONSTRAINT "support_tickets_responded_by_user_id_fkey"
FOREIGN KEY ("responded_by_user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
