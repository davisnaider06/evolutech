import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyModuleEdit {
  id: string;
  modulo_id: string;
  codigo: string;
  nome: string;
  icone: string | null;
  is_core: boolean;
  ativo: boolean;
  obrigatorio: boolean;
}

/**
 * Hook to load and manage modules for a specific company (for editing)
 */
export const useEditCompanyModules = (companyId: string | null) => {
  const [modules, setModules] = useState<CompanyModuleEdit[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCompanyModules = useCallback(async () => {
    if (!companyId) {
      setModules([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('empresa_modulos')
        .select(`
          id,
          modulo_id,
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
        .eq('empresa_id', companyId);

      if (error) {
        console.error('Error fetching company modules:', error);
        return;
      }

      if (data) {
        const mappedModules: CompanyModuleEdit[] = data
          .filter((item: any) => item.modulos)
          .map((item: any) => ({
            id: item.id,
            modulo_id: item.modulo_id,
            codigo: item.modulos.codigo,
            nome: item.modulos.nome,
            icone: item.modulos.icone,
            is_core: false, // All modules are now available
            ativo: item.ativo ?? true,
            obrigatorio: false, // All modules are optional
          }));

        setModules(mappedModules);
      }
    } catch (err) {
      console.error('Error in useEditCompanyModules:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompanyModules();
  }, [fetchCompanyModules]);

  /**
   * Toggle module active state
   */
  const toggleModule = useCallback(async (moduleId: string, newActiveState: boolean) => {
    if (!companyId) return false;

    try {
      const { error } = await supabase
        .from('empresa_modulos')
        .update({ ativo: newActiveState })
        .eq('empresa_id', companyId)
        .eq('modulo_id', moduleId);

      if (error) {
        console.error('Error toggling module:', error);
        return false;
      }

      // Update local state
      setModules(prev => prev.map(m => 
        m.modulo_id === moduleId ? { ...m, ativo: newActiveState } : m
      ));

      return true;
    } catch (err) {
      console.error('Error in toggleModule:', err);
      return false;
    }
  }, [companyId]);

  /**
   * Sync new modules to company (add missing ones)
   */
  const syncModules = useCallback(async (moduleIds: string[]) => {
    if (!companyId || moduleIds.length === 0) return false;

    try {
      // Get existing module IDs
      const existingModuleIds = modules.map(m => m.modulo_id);
      
      // Find new modules to add
      const newModuleIds = moduleIds.filter(id => !existingModuleIds.includes(id));
      
      if (newModuleIds.length > 0) {
        // Get module info
        const { data: modulesInfo } = await supabase
          .from('modulos')
          .select('id, is_core')
          .in('id', newModuleIds);

        // Prepare inserts - all modules are optional
        const inserts = newModuleIds.map(moduleId => {
          return {
            empresa_id: companyId,
            modulo_id: moduleId,
            ativo: true,
            obrigatorio: false, // All modules are optional
          };
        });

        const { error } = await supabase
          .from('empresa_modulos')
          .upsert(inserts, { onConflict: 'empresa_id,modulo_id' });

        if (error) {
          console.error('Error syncing modules:', error);
          return false;
        }
      }

      // Deactivate modules that were removed - all modules can be deactivated now
      const removedModuleIds = existingModuleIds.filter(id => !moduleIds.includes(id));
      
      for (const moduleId of removedModuleIds) {
        await supabase
          .from('empresa_modulos')
          .update({ ativo: false })
          .eq('empresa_id', companyId)
          .eq('modulo_id', moduleId);
      }

      // Refresh
      await fetchCompanyModules();
      return true;
    } catch (err) {
      console.error('Error in syncModules:', err);
      return false;
    }
  }, [companyId, modules, fetchCompanyModules]);

  return {
    modules,
    isLoading,
    toggleModule,
    syncModules,
    refreshModules: fetchCompanyModules,
    activeModuleIds: modules.filter(m => m.ativo).map(m => m.modulo_id),
  };
};
