import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Blocks, Package, Loader2 } from 'lucide-react';

interface SistemaBase {
  id: string;
  nome: string;
  nicho: string;
  porte: string | null;
  descricao: string | null;
}

interface Modulo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  is_core: boolean;
  icone: string | null;
}

interface TemplateModulo {
  modulo_id: string;
  is_default: boolean;
  modulo: Modulo;
}

interface TemplateModulesSelectorProps {
  selectedTemplateId: string;
  onTemplateChange: (templateId: string) => void;
  selectedModules: string[];
  onModulesChange: (moduleIds: string[]) => void;
  companyId?: string | null; // For edit mode - load existing company modules
  mode?: 'create' | 'edit';
}

export const TemplateModulesSelector: React.FC<TemplateModulesSelectorProps> = ({
  selectedTemplateId,
  onTemplateChange,
  selectedModules,
  onModulesChange,
  companyId = null,
  mode = 'create',
}) => {
  const [templates, setTemplates] = useState<SistemaBase[]>([]);
  const [templateModulos, setTemplateModulos] = useState<TemplateModulo[]>([]);
  const [allModulos, setAllModulos] = useState<Modulo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModules, setIsLoadingModules] = useState(false);

  // Fetch all templates
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('sistemas_base')
        .select('id, nome, nicho, porte, descricao')
        .eq('status', 'active')
        .order('nicho')
        .order('porte');
      
      setTemplates(data || []);
      setIsLoading(false);
    };
    
    fetchTemplates();
  }, []);

  // Fetch all available modules
  useEffect(() => {
    const fetchModulos = async () => {
      const { data } = await supabase
        .from('modulos')
        .select('id, codigo, nome, descricao, is_core, icone')
        .eq('status', 'active')
        .order('is_core', { ascending: false })
        .order('nome');
      
      setAllModulos(data || []);
    };
    
    fetchModulos();
  }, []);

  // Fetch existing company modules (for edit mode)
  const fetchCompanyModules = useCallback(async () => {
    if (!companyId || mode !== 'edit') return;

    setIsLoadingModules(true);
    
    const { data, error } = await supabase
      .from('empresa_modulos')
      .select(`
        modulo_id,
        ativo,
        modulos (
          id,
          codigo,
          nome,
          descricao,
          is_core,
          icone
        )
      `)
      .eq('empresa_id', companyId)
      .eq('ativo', true);

    if (error) {
      console.error('Error fetching company modules:', error);
      setIsLoadingModules(false);
      return;
    }

    const modulosWithData = (data || [])
      .filter((item: any) => item.modulos)
      .map((item: any) => ({
        modulo_id: item.modulo_id,
        is_default: true,
        modulo: item.modulos as Modulo,
      }));

    setTemplateModulos(modulosWithData);
    
    // Set selected modules from company
    const moduleIds = modulosWithData.map(m => m.modulo_id);
    onModulesChange(moduleIds);
    
    setIsLoadingModules(false);
  }, [companyId, mode, onModulesChange]);

  // Fetch modules for selected template (create mode)
  const fetchTemplateModules = useCallback(async (templateId: string) => {
    if (!templateId || mode === 'edit') {
      if (mode !== 'edit') {
        setTemplateModulos([]);
        onModulesChange([]);
      }
      return;
    }

    setIsLoadingModules(true);
    
    const { data, error } = await supabase
      .from('sistema_base_modulos')
      .select(`
        modulo_id,
        is_default,
        modulos (
          id,
          codigo,
          nome,
          descricao,
          is_core,
          icone
        )
      `)
      .eq('sistema_base_id', templateId);

    if (error) {
      console.error('Error fetching template modules:', error);
      setIsLoadingModules(false);
      return;
    }

    const modulosWithData = (data || [])
      .filter((item: any) => item.modulos)
      .map((item: any) => ({
        modulo_id: item.modulo_id,
        is_default: item.is_default || false,
        modulo: item.modulos as Modulo,
      }));

    setTemplateModulos(modulosWithData);
    
    // Auto-select all template modules
    const moduleIds = modulosWithData.map(m => m.modulo_id);
    onModulesChange(moduleIds);
    
    setIsLoadingModules(false);
  }, [mode, onModulesChange]);

  // Load company modules in edit mode
  useEffect(() => {
    if (mode === 'edit' && companyId) {
      fetchCompanyModules();
    }
  }, [mode, companyId, fetchCompanyModules]);

  // Load template modules in create mode
  useEffect(() => {
    if (mode === 'create' && selectedTemplateId) {
      fetchTemplateModules(selectedTemplateId);
    }
  }, [mode, selectedTemplateId, fetchTemplateModules]);

  const handleTemplateChange = (templateId: string) => {
    onTemplateChange(templateId);
  };

  const handleModuleToggle = (moduleId: string) => {
    // All modules can be toggled now - no core restriction
    if (selectedModules.includes(moduleId)) {
      onModulesChange(selectedModules.filter(id => id !== moduleId));
    } else {
      onModulesChange([...selectedModules, moduleId]);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  
  // Group templates by niche
  const templatesByNiche = templates.reduce((acc, template) => {
    const niche = template.nicho || 'Outros';
    if (!acc[niche]) acc[niche] = [];
    acc[niche].push(template);
    return acc;
  }, {} as Record<string, SistemaBase[]>);

  const getPorteLabel = (porte: string | null) => {
    switch (porte) {
      case 'pequeno': return 'Pequeno';
      case 'medio': return 'Médio';
      case 'grande': return 'Grande';
      default: return porte || '';
    }
  };

  const getPorteColor = (porte: string | null) => {
    switch (porte) {
      case 'pequeno': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'medio': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'grande': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return '';
    }
  };

  // Get additional modules not in template
  const additionalModules = allModulos.filter(
    m => !templateModulos.some(tm => tm.modulo_id === m.id)
  );

  return (
    <div className="space-y-4">
      {/* Template Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Blocks className="h-4 w-4" />
          Sistema Base (Template)
        </Label>
        <Select
          value={selectedTemplateId}
          onValueChange={handleTemplateChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um template..." />
          </SelectTrigger>
          <SelectContent 
            position="popper" 
            sideOffset={4}
            className="max-h-[300px]"
          >
            {Object.entries(templatesByNiche).map(([niche, nicheTemplates]) => (
              <div key={niche}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-secondary/50">
                  {niche}
                </div>
                {nicheTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <span>{template.nome}</span>
                      {template.porte && (
                        <Badge variant="outline" className={`text-xs ${getPorteColor(template.porte)}`}>
                          {getPorteLabel(template.porte)}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        
        {selectedTemplate?.descricao && (
          <p className="text-xs text-muted-foreground">{selectedTemplate.descricao}</p>
        )}
      </div>

      {/* Modules Section */}
      {selectedTemplateId && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Módulos ({selectedModules.length} selecionados)
          </Label>
          
          {isLoadingModules ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[180px] rounded-lg border border-border bg-secondary/20 p-2">
              <Accordion type="multiple" defaultValue={['template', 'additional']} className="space-y-2">
                {/* Template Modules */}
                <AccordionItem value="template" className="border-none">
                  <AccordionTrigger className="py-2 px-3 rounded-lg bg-secondary/50 hover:bg-secondary/70 text-sm">
                    Módulos do Template ({templateModulos.length})
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-1">
                    {templateModulos.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-2">
                        Nenhum módulo configurado para este template
                      </p>
                    ) : (
                      templateModulos.map((tm) => (
                        <div
                          key={tm.modulo_id}
                          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/30 transition-colors"
                        >
                          <Checkbox
                            id={tm.modulo_id}
                            checked={selectedModules.includes(tm.modulo_id)}
                            onCheckedChange={() => handleModuleToggle(tm.modulo_id)}
                          />
                          <label
                            htmlFor={tm.modulo_id}
                            className="flex-1 text-sm cursor-pointer flex items-center gap-2"
                          >
                            <span>{tm.modulo.nome}</span>
                          </label>
                        </div>
                      ))
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Additional Modules */}
                {additionalModules.length > 0 && (
                  <AccordionItem value="additional" className="border-none">
                    <AccordionTrigger className="py-2 px-3 rounded-lg bg-secondary/50 hover:bg-secondary/70 text-sm">
                      Módulos Adicionais ({additionalModules.length})
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 space-y-1">
                      {additionalModules.map((modulo) => (
                        <div
                          key={modulo.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/30 transition-colors"
                        >
                          <Checkbox
                            id={`add-${modulo.id}`}
                            checked={selectedModules.includes(modulo.id)}
                            onCheckedChange={() => handleModuleToggle(modulo.id)}
                          />
                          <label
                            htmlFor={`add-${modulo.id}`}
                            className="flex-1 text-sm cursor-pointer flex items-center gap-2"
                          >
                            <span>{modulo.nome}</span>
                          </label>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
};
