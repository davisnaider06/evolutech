import { useAuth } from '@/contexts/AuthContext';
import { companyService } from '@/services/company';

type AuditAction =
  | 'create' | 'update' | 'delete' | 'login' | 'logout'
  | 'activate' | 'deactivate' | 'invite' | 'role_change';

interface LogAuditParams {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  companyId?: string;
  details?: Record<string, unknown>;
}

/**
 * Registra acoes da interface na auditoria.
 *
 * Grava no Neon, pela API. Antes ia para o Supabase — um banco separado que
 * ninguem consultava, entao esses registros nao apareciam na tela de Logs.
 *
 * A falha no registro nunca interrompe a acao do usuario: auditoria e um
 * efeito colateral, nao parte da operacao.
 */
export const useAuditLog = () => {
  const { user } = useAuth();

  const logAudit = async ({ action, entityType, entityId, details = {} }: LogAuditParams) => {
    try {
      await companyService.registrarAuditoria({
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: { ...details, user_email: user?.email },
      });
    } catch (error) {
      console.error('[auditoria] nao consegui registrar:', error);
    }
  };

  const logAction = async (
    action: AuditAction,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown>
  ) => logAudit({ action, entityType, entityId, details });

  return { logAudit, logAction };
};
