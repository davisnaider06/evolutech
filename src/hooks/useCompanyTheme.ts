import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CompanyTheme {
  id: string;
  company_id: string;
  logo_path: string | null;
  favicon_path: string | null;
  login_cover_path: string | null;
  company_display_name: string | null;
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

const DEFAULT_THEME: Omit<CompanyTheme, 'id' | 'company_id'> = {
  logo_path: null,
  favicon_path: null,
  login_cover_path: null,
  company_display_name: null,
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

export const useCompanyTheme = () => {
  const { user } = useAuth();
  const [theme, setTheme] = useState<CompanyTheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTheme = useCallback(async () => {
    if (!user?.tenantId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('company_themes')
        .select('*')
        .eq('company_id', user.tenantId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching company theme:', error);
        setIsLoading(false);
        return;
      }

      if (data) {
        setTheme(data as CompanyTheme);
      } else {
        // No theme exists, use defaults
        setTheme(null);
      }
    } catch (err) {
      console.error('Error in useCompanyTheme:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  const updateTheme = useCallback(async (updates: Partial<CompanyTheme>) => {
    if (!user?.tenantId) return false;

    try {
      const { error } = await supabase
        .from('company_themes')
        .upsert({
          company_id: user.tenantId,
          ...updates,
        }, {
          onConflict: 'company_id',
        });

      if (error) {
        console.error('Error updating company theme:', error);
        return false;
      }

      await fetchTheme();
      return true;
    } catch (err) {
      console.error('Error in updateTheme:', err);
      return false;
    }
  }, [user?.tenantId, fetchTheme]);

  const refreshTheme = useCallback(() => {
    setIsLoading(true);
    fetchTheme();
  }, [fetchTheme]);

  return {
    theme,
    defaultTheme: DEFAULT_THEME,
    isLoading,
    updateTheme,
    refreshTheme,
  };
};

// Apply theme CSS variables to document root
export const applyThemeToDocument = (theme: CompanyTheme | null) => {
  const root = document.documentElement;
  
  if (!theme) return;

  // Apply color variables
  root.style.setProperty('--primary', theme.primary_color);
  root.style.setProperty('--primary-foreground', theme.primary_foreground);
  root.style.setProperty('--secondary', theme.secondary_color);
  root.style.setProperty('--secondary-foreground', theme.secondary_foreground);
  root.style.setProperty('--accent', theme.accent_color);
  root.style.setProperty('--accent-foreground', theme.accent_foreground);
  root.style.setProperty('--background', theme.background_color);
  root.style.setProperty('--foreground', theme.foreground_color);
  root.style.setProperty('--card', theme.card_color);
  root.style.setProperty('--card-foreground', theme.card_foreground);
  root.style.setProperty('--muted', theme.muted_color);
  root.style.setProperty('--muted-foreground', theme.muted_foreground);
  root.style.setProperty('--border', theme.border_color);
  root.style.setProperty('--input', theme.border_color);
  root.style.setProperty('--destructive', theme.destructive_color);
  
  // Sidebar colors
  root.style.setProperty('--sidebar-background', theme.sidebar_background);
  root.style.setProperty('--sidebar-foreground', theme.sidebar_foreground);
  root.style.setProperty('--sidebar-primary', theme.sidebar_primary);
  root.style.setProperty('--sidebar-accent', theme.sidebar_accent);
  
  // UI customization
  root.style.setProperty('--radius', theme.border_radius);
  
  // Font family
  if (theme.font_family) {
    root.style.setProperty('--font-family', theme.font_family);
    document.body.style.fontFamily = `'${theme.font_family}', system-ui, sans-serif`;
  }
};

// Reset theme to defaults
export const resetThemeToDefaults = () => {
  const root = document.documentElement;
  
  root.style.removeProperty('--primary');
  root.style.removeProperty('--primary-foreground');
  root.style.removeProperty('--secondary');
  root.style.removeProperty('--secondary-foreground');
  root.style.removeProperty('--accent');
  root.style.removeProperty('--accent-foreground');
  root.style.removeProperty('--background');
  root.style.removeProperty('--foreground');
  root.style.removeProperty('--card');
  root.style.removeProperty('--card-foreground');
  root.style.removeProperty('--muted');
  root.style.removeProperty('--muted-foreground');
  root.style.removeProperty('--border');
  root.style.removeProperty('--input');
  root.style.removeProperty('--destructive');
  root.style.removeProperty('--sidebar-background');
  root.style.removeProperty('--sidebar-foreground');
  root.style.removeProperty('--sidebar-primary');
  root.style.removeProperty('--sidebar-accent');
  root.style.removeProperty('--radius');
  root.style.removeProperty('--font-family');
  document.body.style.fontFamily = '';
};
