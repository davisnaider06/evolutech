import { supabase } from '@/integrations/supabase/client';

/**
 * Sync modules from template to a company
 * This is called when creating a new company with a template
 */
export const syncTemplateModulesToCompany = async (
  companyId: string,
  templateId: string
): Promise<boolean> => {
  if (!companyId || !templateId) {
    return false;
  }

  try {
    // Fetch modules from the template
    const { data: templateModules, error: templateError } = await supabase
      .from('sistema_base_modulos')
      .select(`
        modulo_id,
        is_default,
        modulos (
          id,
          is_core
        )
      `)
      .eq('sistema_base_id', templateId);

    if (templateError) {
      console.error('Error fetching template modules:', templateError);
      return false;
    }

    if (!templateModules || templateModules.length === 0) {
      console.warn('No modules found for template:', templateId);
      return true; // Not an error, just no modules
    }

    // Prepare inserts - all modules are optional now
    const inserts = templateModules.map((tm: any) => ({
      empresa_id: companyId,
      modulo_id: tm.modulo_id,
      ativo: true,
      obrigatorio: false, // All modules are optional
    }));

    // Upsert modules
    const { error: insertError } = await supabase
      .from('empresa_modulos')
      .upsert(inserts, {
        onConflict: 'empresa_id,modulo_id',
      });

    if (insertError) {
      console.error('Error syncing template modules:', insertError);
      return false;
    }

    console.log(`Synced ${inserts.length} modules from template to company`);
    return true;
  } catch (err) {
    console.error('Error in syncTemplateModulesToCompany:', err);
    return false;
  }
};

/**
 * Sync specific modules to a company
 * This allows for custom module selection during company creation
 */
export const syncCustomModulesToCompany = async (
  companyId: string,
  moduleIds: string[]
): Promise<boolean> => {
  if (!companyId || moduleIds.length === 0) {
    return false;
  }

  try {
    // First, get info about which modules are core
    const { data: modulesInfo, error: modulesError } = await supabase
      .from('modulos')
      .select('id, is_core')
      .in('id', moduleIds);

    if (modulesError) {
      console.error('Error fetching modules info:', modulesError);
      return false;
    }

    // Prepare inserts - all modules are optional now
    const inserts = moduleIds.map(moduleId => {
      return {
        empresa_id: companyId,
        modulo_id: moduleId,
        ativo: true,
        obrigatorio: false, // All modules are optional
      };
    });

    // Upsert modules
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
    console.error('Error in syncCustomModulesToCompany:', err);
    return false;
  }
};

/**
 * Get modules for a company
 */
export const getCompanyModules = async (companyId: string) => {
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
    .eq('empresa_id', companyId)
    .eq('ativo', true);

  if (error) {
    console.error('Error fetching company modules:', error);
    return [];
  }

  return data || [];
};
