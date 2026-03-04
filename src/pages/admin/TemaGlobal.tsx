import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { adminService } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Palette,
  Upload,
  Save,
  ImageIcon,
  Building2,
  Eye,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

interface CompanyTheme {
  id: string;
  company_id: string;
  company_display_name: string | null;
  logo_path: string | null;
  favicon_path: string | null;
  login_cover_path: string | null;
  primary_color: string;
  primary_foreground: string;
  secondary_color: string;
  secondary_foreground: string;
  accent_color: string;
  accent_foreground: string;
  background_color: string;
  foreground_color: string;
  card_color: string;
  card_foreground: string;
  muted_color: string;
  muted_foreground: string;
  border_color: string;
  destructive_color: string;
  sidebar_background: string;
  sidebar_foreground: string;
  sidebar_primary: string;
  sidebar_accent: string;
  border_radius: string;
  font_family: string;
  dark_mode_enabled: boolean;
}

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  status: string;
}

const DEFAULT_THEME: Omit<CompanyTheme, 'id' | 'company_id'> = {
  company_display_name: null,
  logo_path: null,
  favicon_path: null,
  login_cover_path: null,
  primary_color: '217 91% 60%',
  primary_foreground: '222 47% 6%',
  secondary_color: '217 33% 17%',
  secondary_foreground: '210 40% 98%',
  accent_color: '187 85% 53%',
  accent_foreground: '222 47% 6%',
  background_color: '222 47% 6%',
  foreground_color: '210 40% 98%',
  card_color: '222 47% 8%',
  card_foreground: '210 40% 98%',
  muted_color: '217 33% 12%',
  muted_foreground: '215 20% 55%',
  border_color: '217 33% 17%',
  destructive_color: '0 84% 60%',
  sidebar_background: '222 47% 7%',
  sidebar_foreground: '210 40% 98%',
  sidebar_primary: '217 91% 60%',
  sidebar_accent: '217 33% 17%',
  border_radius: '0.75rem',
  font_family: 'Inter',
  dark_mode_enabled: true,
};

const ColorPicker: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  const hslToHex = (hsl: string): string => {
    const parts = hsl.split(' ');
    if (parts.length < 3) return '#3b82f6';

    const h = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) / 100 || 0;
    const l = parseFloat(parts[2]) / 100 || 0;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h / 360 + 1 / 3);
      g = hue2rgb(p, q, h / 360);
      b = hue2rgb(p, q, h / 360 - 1 / 3);
    }

    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const hexToHsl = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return value;

    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-8 w-8 rounded-lg border border-border overflow-hidden cursor-pointer"
        style={{ backgroundColor: `hsl(${value})` }}
      >
        <input
          type="color"
          value={hslToHex(value)}
          onChange={(e) => onChange(hexToHsl(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex-1">
        <Label className="text-xs">{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-xs font-mono"
        />
      </div>
    </div>
  );
};

export default function TemaGlobal() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Partial<CompanyTheme> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const tenants = await adminService.listarTenants();
      const list: Company[] = (tenants || [])
        .map((tenant: any) => ({
          id: String(tenant.id),
          name: String(tenant.name || ''),
          logo_url: tenant.logo_url || null,
          status: String(tenant.status || 'active'),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      setCompanies(list);

      if (!selectedCompanyId && list.length > 0) {
        const firstCompany = list[0];
        setSelectedCompanyId(firstCompany.id);
        await fetchCompanyTheme(firstCompany.id, firstCompany.name);
      }
    } catch (error: any) {
      console.error('Erro ao carregar empresas no TemaGlobal:', error);
      toast.error(error?.message || 'Erro ao carregar empresas');
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanyTheme = async (companyId: string, fallbackCompanyName?: string) => {
    const { data, error } = await supabase
      .from('company_themes')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      toast.error('Erro ao carregar tema');
      return;
    }

    if (data) {
      const mergedTheme = {
        ...DEFAULT_THEME,
        ...data,
        company_id: companyId,
      };
      setTheme(mergedTheme);
      setLogoPreview(mergedTheme.logo_path);
      return;
    }

    setTheme({
      ...DEFAULT_THEME,
      company_id: companyId,
      company_display_name: fallbackCompanyName || null,
    });
    setLogoPreview(null);
  };

  const handleCompanySelect = async (companyId: string) => {
    if (!companyId) return;
    setSelectedCompanyId(companyId);
    const company = companies.find((item) => item.id === companyId);
    await fetchCompanyTheme(companyId, company?.name);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompanyId) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no maximo 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);

    const fileExt = file.name.split('.').pop();
    const fileName = `${selectedCompanyId}/logo.${fileExt}`;

    const { error } = await supabase.storage.from('company-logos').upload(fileName, file, { upsert: true });

    if (error) {
      toast.error('Erro ao enviar logo');
      return;
    }

    const { data } = supabase.storage.from('company-logos').getPublicUrl(fileName);

    setTheme((prev) => (prev ? { ...prev, logo_path: data.publicUrl } : null));
    toast.success('Logo atualizado!');
  };

  const handleSave = async () => {
    if (!selectedCompanyId || !theme) return;

    setIsSaving(true);
    try {
      const { id: _ignoreId, company_id: _ignoreCompanyId, ...themeData } = theme;
      const payload = {
        company_id: selectedCompanyId,
        ...DEFAULT_THEME,
        ...themeData,
        company_display_name: theme.company_display_name?.trim() || selectedCompany?.name || null,
      };

      const { error } = await supabase
        .from('company_themes')
        .upsert(payload, {
          onConflict: 'company_id',
        });

      if (error) throw error;

      toast.success('Tema salvo com sucesso!');
      await fetchCompanyTheme(selectedCompanyId, selectedCompany?.name);
    } catch (error: any) {
      console.error('Error saving theme:', error);
      toast.error(error?.message ? `Erro ao salvar tema: ${error.message}` : 'Erro ao salvar tema');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetColors = () => {
    if (!selectedCompanyId) return;

    setTheme((prev) => ({
      ...DEFAULT_THEME,
      company_id: selectedCompanyId,
      company_display_name: prev?.company_display_name || selectedCompany?.name || null,
      logo_path: prev?.logo_path || null,
      favicon_path: prev?.favicon_path || null,
      login_cover_path: prev?.login_cover_path || null,
    }));

    toast.info('Cores resetadas para o padrao. Clique em salvar para aplicar.');
  };

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);

  if (!user || !['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH'].includes(user.role)) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Temas das Empresas</h1>
          <p className="text-muted-foreground">Gerencie cores, logos e identidade visual de cada empresa</p>
        </div>
        <Button variant="outline" onClick={fetchCompanies} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Empresas
            </CardTitle>
            <CardDescription>Selecione uma empresa para editar seu tema</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-3">
                <Select value={selectedCompanyId || ''} onValueChange={handleCompanySelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                          selectedCompanyId === company.id ? 'bg-primary/20 border border-primary/50' : 'hover:bg-secondary/50'
                        }`}
                        onClick={() => handleCompanySelect(company.id)}
                      >
                        {company.logo_url ? (
                          <img src={company.logo_url} alt={company.name} className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-secondary">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium text-sm">{company.name}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {selectedCompany ? `Tema: ${selectedCompany.name}` : 'Selecione uma Empresa'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedCompanyId ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Selecione uma empresa na lista para editar seu tema</p>
              </div>
            ) : (
              <Tabs defaultValue="branding" className="space-y-4">
                <TabsList className="glass">
                  <TabsTrigger value="branding" className="gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Marca
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="gap-2">
                    <Palette className="h-4 w-4" />
                    Cores
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="branding" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Logo da Empresa</Label>
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors overflow-hidden"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} className="gap-2">
                          <Upload className="h-4 w-4" />
                          Enviar Logo
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG ate 2MB</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Nome de Exibicao</Label>
                    <Input
                      value={theme?.company_display_name || selectedCompany?.name || ''}
                      onChange={(e) =>
                        setTheme((prev) => (prev ? { ...prev, company_display_name: e.target.value } : null))
                      }
                      placeholder="Nome exibido no sistema"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="colors" className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ColorPicker
                      label="Cor Primaria"
                      value={theme?.primary_color || DEFAULT_THEME.primary_color}
                      onChange={(value) => setTheme((prev) => (prev ? { ...prev, primary_color: value } : null))}
                    />
                    <ColorPicker
                      label="Texto Primario"
                      value={theme?.primary_foreground || DEFAULT_THEME.primary_foreground}
                      onChange={(value) =>
                        setTheme((prev) => (prev ? { ...prev, primary_foreground: value } : null))
                      }
                    />
                    <ColorPicker
                      label="Cor Secundaria"
                      value={theme?.secondary_color || DEFAULT_THEME.secondary_color}
                      onChange={(value) => setTheme((prev) => (prev ? { ...prev, secondary_color: value } : null))}
                    />
                    <ColorPicker
                      label="Cor de Destaque"
                      value={theme?.accent_color || DEFAULT_THEME.accent_color}
                      onChange={(value) => setTheme((prev) => (prev ? { ...prev, accent_color: value } : null))}
                    />
                    <ColorPicker
                      label="Fundo Principal"
                      value={theme?.background_color || DEFAULT_THEME.background_color}
                      onChange={(value) => setTheme((prev) => (prev ? { ...prev, background_color: value } : null))}
                    />
                    <ColorPicker
                      label="Cor do Texto"
                      value={theme?.foreground_color || DEFAULT_THEME.foreground_color}
                      onChange={(value) => setTheme((prev) => (prev ? { ...prev, foreground_color: value } : null))}
                    />
                    <ColorPicker
                      label="Cor do Card"
                      value={theme?.card_color || DEFAULT_THEME.card_color}
                      onChange={(value) => setTheme((prev) => (prev ? { ...prev, card_color: value } : null))}
                    />
                    <ColorPicker
                      label="Cor da Borda"
                      value={theme?.border_color || DEFAULT_THEME.border_color}
                      onChange={(value) => setTheme((prev) => (prev ? { ...prev, border_color: value } : null))}
                    />
                    <ColorPicker
                      label="Fundo Sidebar"
                      value={theme?.sidebar_background || DEFAULT_THEME.sidebar_background}
                      onChange={(value) =>
                        setTheme((prev) => (prev ? { ...prev, sidebar_background: value } : null))
                      }
                    />
                    <ColorPicker
                      label="Primaria Sidebar"
                      value={theme?.sidebar_primary || DEFAULT_THEME.sidebar_primary}
                      onChange={(value) => setTheme((prev) => (prev ? { ...prev, sidebar_primary: value } : null))}
                    />
                  </div>

                  <div className="mt-4 p-4 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground mb-2">Preview</p>
                    <div
                      className="p-4 rounded-lg border"
                      style={{
                        backgroundColor: `hsl(${theme?.background_color || DEFAULT_THEME.background_color})`,
                        borderColor: `hsl(${theme?.border_color || DEFAULT_THEME.border_color})`,
                        borderRadius: theme?.border_radius || DEFAULT_THEME.border_radius,
                      }}
                    >
                      <div
                        className="mb-3 rounded-md p-3"
                        style={{ backgroundColor: `hsl(${theme?.card_color || DEFAULT_THEME.card_color})` }}
                      >
                        <span style={{ color: `hsl(${theme?.foreground_color || DEFAULT_THEME.foreground_color})` }}>
                          Card de exemplo
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <div
                          className="px-4 py-2 rounded-md inline-block"
                          style={{
                            backgroundColor: `hsl(${theme?.primary_color || DEFAULT_THEME.primary_color})`,
                            borderRadius: theme?.border_radius || DEFAULT_THEME.border_radius,
                          }}
                        >
                          <span style={{ color: `hsl(${theme?.primary_foreground || DEFAULT_THEME.primary_foreground})` }}>
                            Botao Primario
                          </span>
                        </div>

                        <div
                          className="px-4 py-2 rounded-md inline-block border"
                          style={{
                            backgroundColor: `hsl(${theme?.secondary_color || DEFAULT_THEME.secondary_color})`,
                            borderColor: `hsl(${theme?.border_color || DEFAULT_THEME.border_color})`,
                            borderRadius: theme?.border_radius || DEFAULT_THEME.border_radius,
                          }}
                        >
                          <span
                            style={{ color: `hsl(${theme?.secondary_foreground || DEFAULT_THEME.secondary_foreground})` }}
                          >
                            Botao Secundario
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <div className="pt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleResetColors}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Resetar cores
                  </Button>
                  <Button variant="glow" onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Salvando...' : 'Salvar Tema'}
                  </Button>
                </div>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

