import React, { createContext, useContext, useEffect } from 'react';
import { useCompanyTheme, CompanyTheme, applyThemeToDocument, resetThemeToDefaults } from '@/hooks/useCompanyTheme';
import { useAuth } from '@/contexts/AuthContext';

interface ThemeContextType {
  theme: CompanyTheme | null;
  isLoading: boolean;
  updateTheme: (updates: Partial<CompanyTheme>) => Promise<boolean>;
  refreshTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isCompanyUser, user } = useAuth();
  const { theme, isLoading, updateTheme, refreshTheme } = useCompanyTheme();

  // Apply theme when it loads or changes
  useEffect(() => {
    if (isCompanyUser && theme) {
      applyThemeToDocument(theme);
    } else if (!isCompanyUser) {
      // Reset to defaults for Evolutech users
      resetThemeToDefaults();
    }

    // Cleanup on unmount
    return () => {
      resetThemeToDefaults();
    };
  }, [theme, isCompanyUser]);

  // Reset theme when user logs out
  useEffect(() => {
    if (!user) {
      resetThemeToDefaults();
    }
  }, [user]);

  return (
    <ThemeContext.Provider value={{ theme, isLoading, updateTheme, refreshTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
