import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { COURSE_ADMIN_TOKEN_KEY, courseAdminAuthService } from '@/services/course-admin';
import { CourseAdminCompany, CourseAdminManager } from '@/types/course-admin';

interface CourseAdminAuthState {
  manager: CourseAdminManager | null;
  company: CourseAdminCompany | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface CourseAdminAuthContextType extends CourseAdminAuthState {
  login: (token: string, manager: CourseAdminManager, company: CourseAdminCompany) => void;
  logout: () => void;
}

const CourseAdminAuthContext = createContext<CourseAdminAuthContextType | undefined>(undefined);

export const CourseAdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CourseAdminAuthState>({
    manager: null,
    company: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem(COURSE_ADMIN_TOKEN_KEY);
    if (!token) {
      setState({ manager: null, company: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const data = await courseAdminAuthService.me();
      setState({
        manager: data.manager,
        company: data.company,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (_error) {
      localStorage.removeItem(COURSE_ADMIN_TOKEN_KEY);
      setState({ manager: null, company: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback((token: string, manager: CourseAdminManager, company: CourseAdminCompany) => {
    localStorage.setItem(COURSE_ADMIN_TOKEN_KEY, token);
    setState({
      manager,
      company,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(COURSE_ADMIN_TOKEN_KEY);
    setState({ manager: null, company: null, isAuthenticated: false, isLoading: false });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
    }),
    [state, login, logout]
  );

  return <CourseAdminAuthContext.Provider value={value}>{children}</CourseAdminAuthContext.Provider>;
};

export const useCourseAdminAuth = () => {
  const context = useContext(CourseAdminAuthContext);
  if (!context) {
    throw new Error('useCourseAdminAuth deve ser usado dentro de CourseAdminAuthProvider');
  }
  return context;
};
