import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth as useAppAuth } from '@/contexts/AuthContext';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { syncCustomModulesToCompany, syncTemplateModulesToCompany } from '@/hooks/useSyncCompanyModules';
import { useEditCompanyModules } from '@/hooks/useEditCompanyModules';
import { TemplateModulesSelector } from '@/components/empresa/TemplateModulesSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Company } from '@/types/auth';
import { 
  Building2, 
  Plus, 
  Search, 
  MoreVertical,
  Filter,
  ArrowUpDown,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Upload,
  ImageIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const planColors = {
  starter: 'bg-muted text-muted-foreground border-border',
  professional: 'bg-role-admin-evolutech/20 text-role-admin-evolutech border-role-admin-evolutech/30',
  enterprise: 'bg-role-super-admin/20 text-role-super-admin border-role-super-admin/30',
};

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';

const Empresas: React.FC = () => {
  const { user } = useAppAuth();
  const { getToken } = useClerkAuth();
  const { logAudit } = useAuditLog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [empresas, setEmpresas] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'starter' as 'starter' | 'professional' | 'enterprise',
    monthly_revenue: 0,
    sistema_base_id: '' as string,
  });

  const getAuthHeaders = async () => {
    const token = await getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchEmpresas = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/companies`, { headers });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Erro ${response.status}`);
      }
      const data = await response.json();
      setEmpresas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Erro ao carregar empresas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const filteredEmpresas = empresas.filter(empresa =>
    empresa.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (company?: Company) => {
    if (company) {
      setSelectedCompany(company);
      setFormData({
        name: company.name,
        slug: company.slug,
        plan: company.plan,
        monthly_revenue: company.monthly_revenue,
        sistema_base_id: (company as any).sistema_base_id || '',
      });
      setLogoPreview(company.logo_url || null);
      setSelectedModules([]); // Will be loaded by TemplateModulesSelector
    } else {
      setSelectedCompany(null);
      setFormData({ name: '', slug: '', plan: 'starter', monthly_revenue: 0, sistema_base_id: '' });
      setLogoPreview(null);
      setSelectedModules([]);
    }
    setLogoFile(null);
    setIsDialogOpen(true);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 2MB');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (companyId: string): Promise<string | null> => {
    if (!logoFile) return null;
    
    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${companyId}/logo.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('company-logos')
      .upload(fileName, logoFile, { upsert: true });
    
    if (error) {
      console.error('Error uploading logo:', error);
      return null;
    }
    
    const { data } = supabase.storage
      .from('company-logos')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const slug = formData.slug || generateSlug(formData.name);
    setIsUploading(true);

  try {
      if (selectedCompany) {
        let logoUrl = selectedCompany.logo_url;
        
        if (logoFile) {
          const uploadedUrl = await uploadLogo(selectedCompany.id);
          if (uploadedUrl) logoUrl = uploadedUrl;
        }

        const headers = await getAuthHeaders();
        const updateResponse = await fetch(`${API_URL}/companies/${selectedCompany.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: formData.name,
            slug,
            plan: formData.plan,
            monthly_revenue: formData.monthly_revenue,
            logo_url: logoUrl,
            sistema_base_id: formData.sistema_base_id || null,
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}));
          throw new Error(errorData?.error || `Erro ${updateResponse.status}`);
        }

        // Sync modules for existing company
        if (selectedModules.length > 0) {
          const synced = await syncCustomModulesToCompany(selectedCompany.id, selectedModules);
          if (!synced) {
            toast.warning('Módulos não foram sincronizados automaticamente');
          }
        }

        await logAudit({
          action: 'update',
          entityType: 'company',
          entityId: selectedCompany.id,
          details: { name: formData.name, modules_count: selectedModules.length },
        });

        toast.success('Empresa atualizada com sucesso');
      } else {
        const headers = await getAuthHeaders();
        const createResponse = await fetch(`${API_URL}/companies`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: formData.name,
            slug,
            plan: formData.plan,
            monthly_revenue: formData.monthly_revenue,
            sistema_base_id: formData.sistema_base_id || null,
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData?.error || `Erro ${createResponse.status}`);
        }

        const data = await createResponse.json();

        // Upload logo after company is created
        if (logoFile && data) {
          const logoUrl = await uploadLogo(data.id);
          if (logoUrl) {
            const patchLogoResponse = await fetch(`${API_URL}/companies/${data.id}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ logo_url: logoUrl }),
            });
            if (!patchLogoResponse.ok) {
              const errorData = await patchLogoResponse.json().catch(() => ({}));
              console.error('Error patching company logo in backend:', errorData);
            }
          }
        }

        // Sync modules: first try custom selection, then fallback to template defaults
        if (data) {
          let synced = false;
          
          if (selectedModules.length > 0) {
            // User selected specific modules
            synced = await syncCustomModulesToCompany(data.id, selectedModules);
          } else if (formData.sistema_base_id) {
            // No custom selection, use template defaults
            synced = await syncTemplateModulesToCompany(data.id, formData.sistema_base_id);
          }
          
          if (!synced && (selectedModules.length > 0 || formData.sistema_base_id)) {
            toast.warning('Módulos não foram sincronizados automaticamente');
          }
        }

        await logAudit({
          action: 'create',
          entityType: 'company',
          entityId: data.id,
          details: { name: formData.name, sistema_base_id: formData.sistema_base_id },
        });

        toast.success('Empresa criada com sucesso');
      }

      setIsDialogOpen(false);
      fetchEmpresas();
    } catch (error) {
      console.error('Error saving company:', error);
      const message = error instanceof Error ? error.message : 'Erro ao salvar empresa';
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleStatus = async (company: Company) => {
    const newStatus = company.status === 'active' ? 'inactive' : 'active';
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/companies/${company.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Erro ${response.status}`);
      }

      await logAudit({
        action: newStatus === 'active' ? 'activate' : 'deactivate',
        entityType: 'company',
        entityId: company.id,
        details: { name: company.name },
      });

      toast.success(`Empresa ${newStatus === 'active' ? 'ativada' : 'desativada'}`);
      fetchEmpresas();
    } catch (error) {
      console.error('Error toggling status:', error);
      const message = error instanceof Error ? error.message : 'Erro ao alterar status';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/companies/${selectedCompany.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Erro ${response.status}`);
      }

      await logAudit({
        action: 'delete',
        entityType: 'company',
        entityId: selectedCompany.id,
        details: { name: selectedCompany.name },
      });

      toast.success('Empresa excluída com sucesso');
      setIsDeleteDialogOpen(false);
      setSelectedCompany(null);
      fetchEmpresas();
    } catch (error) {
      console.error('Error deleting company:', error);
      const message = error instanceof Error ? error.message : 'Erro ao excluir empresa';
      toast.error(message);
    }
  };

  const activeCount = empresas.filter(e => e.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Empresas</h1>
          <p className="text-muted-foreground">
            Gerencie todas as empresas cadastradas na plataforma
          </p>
        </div>
        <Button variant="glow" className="gap-2" onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar empresas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{empresas.length}</p>
        </div>
        <div className="glass rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Ativas</p>
          <p className="text-2xl font-bold text-role-client-admin">{activeCount}</p>
        </div>
        <div className="glass rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Receita Mensal Total</p>
          <p className="text-2xl font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
              .format(empresas.reduce((acc, e) => acc + Number(e.monthly_revenue || 0), 0))}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Empresa</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Plano</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Receita Mensal</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Criado em</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmpresas.map((empresa, index) => (
                  <tr 
                    key={empresa.id}
                    className={cn(
                      'border-b border-border/50 transition-colors hover:bg-secondary/20 animate-fade-in',
                      index === filteredEmpresas.length - 1 && 'border-b-0'
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {empresa.logo_url ? (
                          <img 
                            src={empresa.logo_url} 
                            alt={empresa.name} 
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Building2 className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{empresa.name}</p>
                          <p className="text-sm text-muted-foreground">{empresa.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={cn('capitalize', planColors[empresa.plan])}>
                        {empresa.plan}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                        .format(Number(empresa.monthly_revenue || 0))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'h-2 w-2 rounded-full',
                          empresa.status === 'active' ? 'bg-role-client-admin' : 'bg-muted-foreground'
                        )} />
                        <span className={cn(
                          'text-sm',
                          empresa.status === 'active' ? 'text-role-client-admin' : 'text-muted-foreground'
                        )}>
                          {empresa.status === 'active' ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(empresa.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              setTimeout(() => handleOpenDialog(empresa), 100);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(empresa)}>
                            {empresa.status === 'active' ? (
                              <>
                                <PowerOff className="h-4 w-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <Power className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          {user?.role === 'SUPER_ADMIN_EVOLUTECH' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setTimeout(() => {
                                    setSelectedCompany(empresa);
                                    setIsDeleteDialogOpen(true);
                                  }, 100);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[85vh]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{selectedCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
            <DialogDescription>
              {selectedCompany ? 'Atualize os dados da empresa' : 'Preencha os dados para criar uma nova empresa'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 min-h-0">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              <div className="flex items-center gap-4">
                <div 
                  className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Escolher Imagem
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG até 2MB</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome da empresa</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ 
                    ...formData, 
                    name: e.target.value,
                    slug: generateSlug(e.target.value),
                  });
                }}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="empresa-exemplo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan">Plano</Label>
                <Select
                  value={formData.plan}
                  onValueChange={(value: 'starter' | 'professional' | 'enterprise') => 
                    setFormData({ ...formData, plan: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Template and Modules Selector */}
            <TemplateModulesSelector
              selectedTemplateId={formData.sistema_base_id}
              onTemplateChange={(templateId) => setFormData({ ...formData, sistema_base_id: templateId })}
              selectedModules={selectedModules}
              onModulesChange={setSelectedModules}
              companyId={selectedCompany?.id}
              mode={selectedCompany ? 'edit' : 'create'}
            />
            <div className="space-y-2">
              <Label htmlFor="revenue">Receita Mensal (R$)</Label>
              <Input
                id="revenue"
                type="number"
                value={formData.monthly_revenue}
                onChange={(e) => setFormData({ ...formData, monthly_revenue: Number(e.target.value) })}
                placeholder="0.00"
              />
            </div>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t border-border mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="glow" disabled={isUploading}>
                {isUploading ? 'Salvando...' : selectedCompany ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados relacionados à empresa 
              "{selectedCompany?.name}" serão permanentemente excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Empresas;
