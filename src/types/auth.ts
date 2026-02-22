export type UserRole = 
  | 'SUPER_ADMIN_EVOLUTECH'
  | 'ADMIN_EVOLUTECH'
  | 'DONO_EMPRESA'
  | 'FUNCIONARIO_EMPRESA';

export type DbRole = 
  | 'super_admin_evolutech'
  | 'admin_evolutech'
  | 'dono_empresa'
  | 'funcionario_empresa';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string;
  tenantName?: string;
  tenantSlug?: string;
  avatar?: string;
  createdAt: Date;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'inactive' | 'pending';
  monthly_revenue: number;
  logo_url?: string;
  sistema_base_id?: string;
  created_at: string;
  updated_at: string;
  employee_count?: number;
}

export interface SistemaBase {
  id: string;
  nome: string;
  descricao?: string;
  nicho: string;
  versao: string;
  status: 'active' | 'inactive' | 'pending';
  configuracoes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Modulo {
  id: string;
  nome: string;
  descricao?: string;
  codigo: string;
  icone?: string;
  preco_mensal: number;
  is_core: boolean;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface SistemaCliente {
  id: string;
  empresa_id: string;
  sistema_base_id: string;
  nome_customizado?: string;
  configuracoes: Record<string, unknown>;
  status: 'active' | 'inactive' | 'pending';
  data_ativacao: string;
  created_at: string;
  updated_at: string;
  sistemas_base?: SistemaBase;
  companies?: Company;
}

export interface EmpresaModulo {
  id: string;
  empresa_id: string;
  modulo_id: string;
  ativo: boolean;
  obrigatorio: boolean;
  data_ativacao: string;
  data_desativacao?: string;
  created_at: string;
  updated_at: string;
  modulos?: Modulo;
}

export interface TicketSuporte {
  id: string;
  empresa_id: string;
  usuario_id: string;
  titulo: string;
  descricao: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'resolvido' | 'fechado';
  categoria?: string;
  atribuido_para?: string;
  resposta?: string;
  data_resolucao?: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; email: string };
  companies?: { name: string };
}

export interface Evolucao {
  id: string;
  sistema_base_id?: string;
  empresa_id?: string;
  titulo: string;
  descricao: string;
  tipo: 'melhoria' | 'correcao' | 'nova_funcionalidade' | 'customizacao';
  status: 'pendente' | 'em_desenvolvimento' | 'em_teste' | 'concluido' | 'cancelado';
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  solicitado_por?: string;
  desenvolvedor_responsavel?: string;
  versao_alvo?: string;
  data_inicio?: string;
  data_conclusao?: string;
  created_at: string;
  updated_at: string;
}

export interface Treinamento {
  id: string;
  empresa_id?: string;
  titulo: string;
  descricao?: string;
  tipo: 'video' | 'documento' | 'webinar' | 'presencial';
  url_conteudo?: string;
  duracao_minutos?: number;
  modulo_id?: string;
  is_publico: boolean;
  ordem: number;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  user_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  company_id?: string | null;
  details: unknown;
  ip_address?: string | null;
  created_at: string;
  profiles?: { full_name: string; email: string } | null;
  companies?: { name: string } | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: DbRole;
  company_id?: string;
  invited_by: string;
  token: string;
  status: 'active' | 'inactive' | 'pending';
  expires_at: string;
  created_at: string;
  companies?: { name: string };
}

export interface FinancialMetric {
  id: string;
  company_id?: string;
  month: string;
  revenue: number;
  mrr: number;
  churn_rate: number;
  new_customers: number;
  active_users: number;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN_EVOLUTECH: 'Super Admin',
  ADMIN_EVOLUTECH: 'Admin Evolutech',
  DONO_EMPRESA: 'Dono da Empresa',
  FUNCIONARIO_EMPRESA: 'Funcionário',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN_EVOLUTECH: 'bg-role-super-admin',
  ADMIN_EVOLUTECH: 'bg-role-admin-evolutech',
  DONO_EMPRESA: 'bg-role-client-admin',
  FUNCIONARIO_EMPRESA: 'bg-role-employee',
};

export const dbRoleToUserRole = (dbRole: DbRole): UserRole => {
  const map: Record<DbRole, UserRole> = {
    super_admin_evolutech: 'SUPER_ADMIN_EVOLUTECH',
    admin_evolutech: 'ADMIN_EVOLUTECH',
    dono_empresa: 'DONO_EMPRESA',
    funcionario_empresa: 'FUNCIONARIO_EMPRESA',
  };
  return map[dbRole];
};

export const userRoleToDbRole = (userRole: UserRole): DbRole => {
  const map: Record<UserRole, DbRole> = {
    SUPER_ADMIN_EVOLUTECH: 'super_admin_evolutech',
    ADMIN_EVOLUTECH: 'admin_evolutech',
    DONO_EMPRESA: 'dono_empresa',
    FUNCIONARIO_EMPRESA: 'funcionario_empresa',
  };
  return map[userRole];
};
