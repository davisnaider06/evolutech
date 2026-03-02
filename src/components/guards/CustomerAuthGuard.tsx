import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';

interface CustomerAuthGuardProps {
  children: React.ReactNode;
}

export const CustomerAuthGuard: React.FC<CustomerAuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useCustomerAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/cliente/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
