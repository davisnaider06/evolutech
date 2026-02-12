import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Palette, 
  Upload, 
  RotateCcw, 
  Save,
  ImageIcon,
  Type,
  Layout,
  Eye,
} from 'lucide-react';

const ColorPicker: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}> = ({ label, value, onChange, description }) => {
  // Convert HSL string to hex for the color picker
  const hslToHex = (hsl: string): string => {
    const parts = hsl.split(' ');
    if (parts.length < 3) return '#3b82f6';
    
    const h = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) / 100 || 0;
    const l = parseFloat(parts[2]) / 100 || 0;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h / 360 + 1/3);
      g = hue2rgb(p, q, h / 360);
      b = hue2rgb(p, q, h / 360 - 1/3);
    }
    
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Convert hex to HSL string
  const hexToHsl = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return value;
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-3">
        <div 
          className="relative h-10 w-10 rounded-lg border-2 border-border overflow-hidden cursor-pointer"
          style={{ backgroundColor: `hsl(${value})` }}
        >
          <input
            type="color"
            value={hslToHex(value)}
            onChange={(e) => onChange(hexToHsl(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="217 91% 60%"
          className="flex-1 font-mono text-sm"
        />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
};

const Personalizacao: React.FC = () => {
  const { theme, updateTheme, isLoading } = useTheme();
  const { user, company } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [localTheme, setLocalTheme] = useState({
    company_display_name: '',
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
    sidebar_background: '222 47% 7%',
    sidebar_foreground: '210 40% 98%',
    sidebar_primary: '217 91% 60%',
    sidebar_accent: '217 33% 17%',
    border_radius: '0.75rem',
    font_family: 'Inter',
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  // Initialize local theme from server theme
  useEffect(() => {
    if (theme) {
      setLocalTheme({
        company_display_name: theme.company_display_name || company?.name || '',
        primary_color: theme.primary_color,
        primary_foreground: theme.primary_foreground,
        secondary_color: theme.secondary_color,
        secondary_foreground: theme.secondary_foreground,
        accent_color: theme.accent_color,
        accent_foreground: theme.accent_foreground,
        background_color: theme.background_color,
        foreground_color: theme.foreground_color,
        card_color: theme.card_color,
        card_foreground: theme.card_foreground,
        muted_color: theme.muted_color,
        muted_foreground: theme.muted_foreground,
        border_color: theme.border_color,
        sidebar_background: theme.sidebar_background,
        sidebar_foreground: theme.sidebar_foreground,
        sidebar_primary: theme.sidebar_primary,
        sidebar_accent: theme.sidebar_accent,
        border_radius: theme.border_radius,
        font_family: theme.font_family,
      });
      if (theme.logo_path) setLogoPreview(theme.logo_path);
      if (theme.favicon_path) setFaviconPreview(theme.favicon_path);
    } else if (company) {
      setLocalTheme(prev => ({
        ...prev,
        company_display_name: company.name,
      }));
      if (company.logo_url) setLogoPreview(company.logo_url);
    }
  }, [theme, company]);

  const handleFileUpload = async (file: File, type: 'logo' | 'favicon'): Promise<string | null> => {
    if (!user?.tenantId) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.tenantId}/${type}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('company-logos')
      .upload(fileName, file, { upsert: true });
    
    if (error) {
      console.error(`Error uploading ${type}:`, error);
      toast.error(`Erro ao enviar ${type === 'logo' ? 'logo' : 'favicon'}`);
      return null;
    }
    
    const { data } = supabase.storage
      .from('company-logos')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }
    
    // Preview
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
    
    // Upload
    const url = await handleFileUpload(file, 'logo');
    if (url) {
      await updateTheme({ logo_path: url });
      toast.success('Logo atualizado!');
    }
  };

  const handleFaviconSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 500 * 1024) {
      toast.error('O favicon deve ter no máximo 500KB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => setFaviconPreview(reader.result as string);
    reader.readAsDataURL(file);
    
    const url = await handleFileUpload(file, 'favicon');
    if (url) {
      await updateTheme({ favicon_path: url });
      toast.success('Favicon atualizado!');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await updateTheme(localTheme);
      if (success) {
        toast.success('Personalização salva com sucesso!');
      } else {
        toast.error('Erro ao salvar personalização');
      }
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error('Erro ao salvar personalização');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setLocalTheme({
      company_display_name: company?.name || '',
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
      sidebar_background: '222 47% 7%',
      sidebar_foreground: '210 40% 98%',
      sidebar_primary: '217 91% 60%',
      sidebar_accent: '217 33% 17%',
      border_radius: '0.75rem',
      font_family: 'Inter',
    });
    toast.info('Tema resetado para valores padrão. Clique em Salvar para aplicar.');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Personalização</h1>
          <p className="text-muted-foreground">
            Customize as cores, logo e identidade visual do seu sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar
          </Button>
          <Button variant="glow" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="glass">
          <TabsTrigger value="branding" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Marca
          </TabsTrigger>
          <TabsTrigger value="colors" className="gap-2">
            <Palette className="h-4 w-4" />
            Cores
          </TabsTrigger>
          <TabsTrigger value="typography" className="gap-2">
            <Type className="h-4 w-4" />
            Tipografia
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Identidade Visual</CardTitle>
              <CardDescription>
                Configure o logo, favicon e nome de exibição da sua empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Name */}
              <div className="space-y-2">
                <Label>Nome de Exibição</Label>
                <Input
                  value={localTheme.company_display_name}
                  onChange={(e) => setLocalTheme({ ...localTheme, company_display_name: e.target.value })}
                  placeholder="Nome da sua empresa"
                />
                <p className="text-xs text-muted-foreground">
                  Este nome será exibido no menu e cabeçalho do sistema
                </p>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Logo da Empresa</Label>
                <div className="flex items-center gap-4">
                  <div 
                    className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors overflow-hidden"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => logoInputRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Escolher Logo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPG ou SVG. Máximo 2MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Favicon Upload */}
              <div className="space-y-2">
                <Label>Favicon</Label>
                <div className="flex items-center gap-4">
                  <div 
                    className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors overflow-hidden"
                    onClick={() => faviconInputRef.current?.click()}
                  >
                    {faviconPreview ? (
                      <img src={faviconPreview} alt="Favicon" className="h-full w-full object-contain" />
                    ) : (
                      <Layout className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/png,image/x-icon,image/svg+xml"
                      onChange={handleFaviconSelect}
                      className="hidden"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => faviconInputRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Escolher Favicon
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG ou ICO. Máximo 500KB.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Primary Colors */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Cores Principais</CardTitle>
                <CardDescription>
                  Cores usadas em botões, links e elementos de destaque
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorPicker
                  label="Cor Primária"
                  value={localTheme.primary_color}
                  onChange={(value) => setLocalTheme({ ...localTheme, primary_color: value })}
                  description="Usada em botões e elementos principais"
                />
                <ColorPicker
                  label="Texto Primário"
                  value={localTheme.primary_foreground}
                  onChange={(value) => setLocalTheme({ ...localTheme, primary_foreground: value })}
                />
                <ColorPicker
                  label="Cor de Destaque"
                  value={localTheme.accent_color}
                  onChange={(value) => setLocalTheme({ ...localTheme, accent_color: value })}
                />
              </CardContent>
            </Card>

            {/* Background Colors */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Cores de Fundo</CardTitle>
                <CardDescription>
                  Cores de fundo do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorPicker
                  label="Fundo Principal"
                  value={localTheme.background_color}
                  onChange={(value) => setLocalTheme({ ...localTheme, background_color: value })}
                />
                <ColorPicker
                  label="Texto Principal"
                  value={localTheme.foreground_color}
                  onChange={(value) => setLocalTheme({ ...localTheme, foreground_color: value })}
                />
                <ColorPicker
                  label="Fundo do Card"
                  value={localTheme.card_color}
                  onChange={(value) => setLocalTheme({ ...localTheme, card_color: value })}
                />
              </CardContent>
            </Card>

            {/* Sidebar Colors */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Menu Lateral</CardTitle>
                <CardDescription>
                  Cores do menu de navegação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorPicker
                  label="Fundo do Menu"
                  value={localTheme.sidebar_background}
                  onChange={(value) => setLocalTheme({ ...localTheme, sidebar_background: value })}
                />
                <ColorPicker
                  label="Texto do Menu"
                  value={localTheme.sidebar_foreground}
                  onChange={(value) => setLocalTheme({ ...localTheme, sidebar_foreground: value })}
                />
                <ColorPicker
                  label="Item Ativo"
                  value={localTheme.sidebar_primary}
                  onChange={(value) => setLocalTheme({ ...localTheme, sidebar_primary: value })}
                />
              </CardContent>
            </Card>

            {/* Secondary Colors */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Cores Secundárias</CardTitle>
                <CardDescription>
                  Cores de elementos secundários e bordas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorPicker
                  label="Cor Secundária"
                  value={localTheme.secondary_color}
                  onChange={(value) => setLocalTheme({ ...localTheme, secondary_color: value })}
                />
                <ColorPicker
                  label="Cor de Borda"
                  value={localTheme.border_color}
                  onChange={(value) => setLocalTheme({ ...localTheme, border_color: value })}
                />
                <ColorPicker
                  label="Cor Muted"
                  value={localTheme.muted_color}
                  onChange={(value) => setLocalTheme({ ...localTheme, muted_color: value })}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography" className="space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Tipografia e Estilo</CardTitle>
              <CardDescription>
                Configure a fonte e o estilo visual do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Família de Fonte</Label>
                <Input
                  value={localTheme.font_family}
                  onChange={(e) => setLocalTheme({ ...localTheme, font_family: e.target.value })}
                  placeholder="Inter"
                />
                <p className="text-xs text-muted-foreground">
                  Nome da fonte do Google Fonts (ex: Inter, Roboto, Poppins)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Raio das Bordas</Label>
                <Input
                  value={localTheme.border_radius}
                  onChange={(e) => setLocalTheme({ ...localTheme, border_radius: e.target.value })}
                  placeholder="0.75rem"
                />
                <p className="text-xs text-muted-foreground">
                  Arredondamento dos cantos (ex: 0.5rem, 0.75rem, 1rem)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-6">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Pré-visualização</CardTitle>
              <CardDescription>
                Veja como as mudanças afetam o visual do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="rounded-xl p-6 border"
                style={{
                  backgroundColor: `hsl(${localTheme.background_color})`,
                  borderColor: `hsl(${localTheme.border_color})`,
                  color: `hsl(${localTheme.foreground_color})`,
                }}
              >
                <div className="flex items-center gap-4 mb-6">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-12 w-12 rounded-lg object-contain" />
                  ) : (
                    <div 
                      className="h-12 w-12 rounded-lg flex items-center justify-center font-bold text-xl"
                      style={{
                        backgroundColor: `hsl(${localTheme.primary_color})`,
                        color: `hsl(${localTheme.primary_foreground})`,
                      }}
                    >
                      {localTheme.company_display_name?.charAt(0) || 'E'}
                    </div>
                  )}
                  <span className="text-lg font-semibold">
                    {localTheme.company_display_name || 'Minha Empresa'}
                  </span>
                </div>

                <div 
                  className="rounded-lg p-4 mb-4"
                  style={{
                    backgroundColor: `hsl(${localTheme.card_color})`,
                    color: `hsl(${localTheme.card_foreground})`,
                  }}
                >
                  <h3 className="font-semibold mb-2">Card de Exemplo</h3>
                  <p 
                    className="text-sm"
                    style={{ color: `hsl(${localTheme.muted_foreground})` }}
                  >
                    Este é um exemplo de card com o tema personalizado.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 rounded-md font-medium text-sm"
                    style={{
                      backgroundColor: `hsl(${localTheme.primary_color})`,
                      color: `hsl(${localTheme.primary_foreground})`,
                      borderRadius: localTheme.border_radius,
                    }}
                  >
                    Botão Primário
                  </button>
                  <button
                    className="px-4 py-2 rounded-md font-medium text-sm border"
                    style={{
                      backgroundColor: `hsl(${localTheme.secondary_color})`,
                      color: `hsl(${localTheme.secondary_foreground})`,
                      borderColor: `hsl(${localTheme.border_color})`,
                      borderRadius: localTheme.border_radius,
                    }}
                  >
                    Botão Secundário
                  </button>
                  <button
                    className="px-4 py-2 rounded-md font-medium text-sm"
                    style={{
                      backgroundColor: `hsl(${localTheme.accent_color})`,
                      color: `hsl(${localTheme.accent_foreground})`,
                      borderRadius: localTheme.border_radius,
                    }}
                  >
                    Destaque
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Personalizacao;
