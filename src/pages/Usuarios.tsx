import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleBadge } from '@/components/RoleBadge';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/auth';
import { 
  Plus, 
  Search, 
  MoreVertical,
  Filter,
  Mail,
  Calendar,
} from 'lucide-react';

interface Usuario {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantName?: string;
  isActive: boolean;
  lastLogin: string;
  createdAt: string;
}

const usuarios: Usuario[] = [
  { id: '1', name: 'Super Admin', email: 'super@evolutech.com', role: 'SUPER_ADMIN_EVOLUTECH', isActive: true, lastLogin: 'Há 5 min', createdAt: '2023-01-01' },
  { id: '2', name: 'Admin Evolutech', email: 'admin@evolutech.com', role: 'ADMIN_EVOLUTECH', isActive: true, lastLogin: 'Há 1 hora', createdAt: '2023-02-15' },
  { id: '3', name: 'João Silva', email: 'joao@empresaxyz.com', role: 'DONO_EMPRESA', tenantName: 'Empresa XYZ', isActive: true, lastLogin: 'Há 30 min', createdAt: '2024-01-10' },
  { id: '4', name: 'Maria Santos', email: 'maria@empresaxyz.com', role: 'FUNCIONARIO_EMPRESA', tenantName: 'Empresa XYZ', isActive: true, lastLogin: 'Há 2 horas', createdAt: '2024-02-20' },
  { id: '5', name: 'Carlos Oliveira', email: 'carlos@techsolutions.com', role: 'DONO_EMPRESA', tenantName: 'Tech Solutions', isActive: true, lastLogin: 'Há 1 dia', createdAt: '2024-02-01' },
  { id: '6', name: 'Ana Pereira', email: 'ana@techsolutions.com', role: 'FUNCIONARIO_EMPRESA', tenantName: 'Tech Solutions', isActive: false, lastLogin: 'Há 1 semana', createdAt: '2024-03-05' },
];

const Usuarios: React.FC = () => {
  const { hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const isEvolutechTeam = hasPermission(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']);

  const filteredUsuarios = usuarios.filter(usuario => {
    const matchesSearch = 
      usuario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter based on role permissions
    if (!isEvolutechTeam) {
      // Client admins only see users from their tenant
      return matchesSearch && (usuario.role === 'FUNCIONARIO_EMPRESA' || usuario.role === 'DONO_EMPRESA');
    }
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Usuários</h1>
          <p className="text-muted-foreground">
            {isEvolutechTeam 
              ? 'Gerencie todos os usuários da plataforma'
              : 'Gerencie os funcionários da sua empresa'
            }
          </p>
        </div>
        <Button variant="glow" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      {/* Users Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredUsuarios.map((usuario, index) => (
          <div
            key={usuario.id}
            className={cn(
              'glass rounded-xl p-5 transition-all duration-200 hover:shadow-elevated hover:border-primary/30 animate-fade-in'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-primary text-lg font-semibold text-primary-foreground">
                    {usuario.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={cn(
                    'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
                    usuario.isActive ? 'bg-role-client-admin' : 'bg-muted-foreground'
                  )} />
                </div>
                <div>
                  <p className="font-semibold">{usuario.name}</p>
                  <RoleBadge role={usuario.role} size="sm" />
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{usuario.email}</span>
              </div>
              {usuario.tenantName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded">
                    {usuario.tenantName}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Último login: {usuario.lastLogin}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Usuarios;
