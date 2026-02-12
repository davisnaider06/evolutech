import React from 'react';
import { UserRole, ROLE_LABELS } from '@/types/auth';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md';
  className?: string;
}

const roleStyles: Record<UserRole, string> = {
  SUPER_ADMIN_EVOLUTECH: 'bg-role-super-admin/20 text-role-super-admin border-role-super-admin/30',
  ADMIN_EVOLUTECH: 'bg-role-admin-evolutech/20 text-role-admin-evolutech border-role-admin-evolutech/30',
  DONO_EMPRESA: 'bg-role-client-admin/20 text-role-client-admin border-role-client-admin/30',
  FUNCIONARIO_EMPRESA: 'bg-role-employee/20 text-role-employee border-role-employee/30',
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md', className }) => {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      roleStyles[role],
      className
    )}>
      {ROLE_LABELS[role]}
    </span>
  );
};
