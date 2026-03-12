ALTER TABLE "sistema_base_modulos"
ADD COLUMN IF NOT EXISTS "allowed_roles" "Role"[] NOT NULL DEFAULT ARRAY['DONO_EMPRESA','FUNCIONARIO_EMPRESA']::"Role"[];

ALTER TABLE "empresa_modulos"
ADD COLUMN IF NOT EXISTS "allowed_roles" "Role"[] NOT NULL DEFAULT ARRAY['DONO_EMPRESA','FUNCIONARIO_EMPRESA']::"Role"[];

UPDATE "sistema_base_modulos" sbm
SET "allowed_roles" = COALESCE(m."allowed_roles", ARRAY['DONO_EMPRESA','FUNCIONARIO_EMPRESA']::"Role"[])
FROM "modulos" m
WHERE m."id" = sbm."modulo_id";

UPDATE "empresa_modulos" em
SET "allowed_roles" = COALESCE(m."allowed_roles", ARRAY['DONO_EMPRESA','FUNCIONARIO_EMPRESA']::"Role"[])
FROM "modulos" m
WHERE m."id" = em."modulo_id";
