import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CompanyModule {
  id: string;
  codigo: string;
  nome: string;
  icone: string | null;
  is_core: boolean;
  ativo: boolean;
  obrigatorio: boolean;
}

export const useCompanyModules = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState<CompanyModule[]>([]);
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchModules = useCallback(async () => {
    if (!user?.tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('empresa_modulos')
        .select(`
          id,
          ativo,
          obrigatorio,
          modulos (
            id,
            codigo,
            nome,
            icone,
            is_core
          )
        `)
        .eq('empresa_id', user.tenantId)
        .eq('ativo', true);

      if (error) {
        console.error('Error fetching company modules:', error);
        setIsLoading(false);
        return;
      }

      if (data) {
        const mappedModules: CompanyModule[] = data
          .filter((item: any) => item.modulos)
          .map((item: any) => ({
            id: item.id,
            codigo: item.modulos.codigo?.toLowerCase() || '',
            nome: item.modulos.nome,
            icone: item.modulos.icone,
            is_core: false, // All modules are now available
            ativo: item.ativo,
            obrigatorio: false, // No mandatory modules
          }));

        setModules(mappedModules);
        setActiveCodes(mappedModules.map(m => m.codigo));
      }
    } catch (err) {
      console.error('Error in useCompanyModules:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const hasModule = useCallback((moduleCode: string): boolean => {
    return activeCodes.includes(moduleCode.toLowerCase());
  }, [activeCodes]);

  const refreshModules = useCallback(() => {
    setIsLoading(true);
    fetchModules();
  }, [fetchModules]);

  return {
    modules,
    activeCodes,
    isLoading,
    hasModule,
    refreshModules,
  };
};

// Sync modules from template to company
export const syncCompanyModules = async (companyId: string, sistemaBaseId: string): Promise<boolean> => {
  try {
    // Get modules from template
    const { data: templateModules, error: templateError } = await supabase
      .from('sistema_base_modulos')
      .select('modulo_id, is_default')
      .eq('sistema_base_id', sistemaBaseId);

    if (templateError) {
      console.error('Error fetching template modules:', templateError);
      return false;
    }

    if (!templateModules || templateModules.length === 0) {
      // If no template modules, add core modules
      const { data: coreModules } = await supabase
        .from('modulos')
        .select('id')
        .eq('is_core', true)
        .eq('status', 'active');

      if (coreModules) {
        const coreInserts = coreModules.map(m => ({
          empresa_id: companyId,
          modulo_id: m.id,
          ativo: true,
          obrigatorio: true,
        }));

        await supabase.from('empresa_modulos').upsert(coreInserts, {
          onConflict: 'empresa_id,modulo_id',
        });
      }
      return true;
    }

    // Insert modules for company
    const inserts = templateModules.map(tm => ({
      empresa_id: companyId,
      modulo_id: tm.modulo_id,
      ativo: true,
      obrigatorio: tm.is_default,
    }));

    const { error: insertError } = await supabase
      .from('empresa_modulos')
      .upsert(inserts, {
        onConflict: 'empresa_id,modulo_id',
      });

    if (insertError) {
      console.error('Error syncing company modules:', insertError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in syncCompanyModules:', err);
    return false;
  }
};
