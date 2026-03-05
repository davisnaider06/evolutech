import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCourseAdminAuth } from '@/contexts/CourseAdminAuthContext';

interface CourseAdminAuthGuardProps {
  children: React.ReactNode;
}

export const CourseAdminAuthGuard: React.FC<CourseAdminAuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useCourseAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/cursos/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
