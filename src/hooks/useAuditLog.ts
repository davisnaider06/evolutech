import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';

type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'activate' | 'deactivate' | 'invite' | 'role_change';

interface LogAuditParams {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  companyId?: string;
  details?: Json;
}

export const useAuditLog = () => {
  const { user } = useAuth();

  const logAudit = async ({ action, entityType, entityId, companyId, details = {} }: LogAuditParams) => {
    try {
      await supabase.from('audit_logs').insert([{
        user_id: user?.id,
        user_email: user?.email,
        action,
        entity_type: entityType,
        entity_id: entityId,
        company_id: companyId,
        details,
      }]);
    } catch (error) {
      console.error('Error logging audit:', error);
    }
  };

  // Alias function for backwards compatibility
  const logAction = async (action: AuditAction, entityType: string, entityId?: string, details?: Json) => {
    return logAudit({ action, entityType, entityId, details });
  };

  return { logAudit, logAction };
};
