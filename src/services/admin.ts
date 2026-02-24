import { API_URL } from '@/config/api';

const API_ADMIN_URL = `${API_URL}/admin`;

const getHeaders = () => {
  const token = localStorage.getItem('evolutech_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${API_ADMIN_URL}${path}`, {
    ...init,
    headers: {
      ...getHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const adminService = {
  financialOverview: async () => request('/financeiro/overview'),
  dashboardMetrics: async () => request('/dashboard/metrics'),
  dashboardActivities: async (limit = 10) => request(`/dashboard/activities?limit=${limit}`),
  listGateways: async () => request('/gateways'),
  createGateway: async (dados: any) => request('/gateways', { method: 'POST', body: JSON.stringify(dados) }),
  updateGateway: async (id: string, dados: any) => request(`/gateways/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
  deleteGateway: async (id: string) => request(`/gateways/${id}`, { method: 'DELETE' }),

  listarModulos: async (onlyActive = false) => request(`/modulos?active=${onlyActive}`),
  criarModulo: async (dados: any) => request('/modulos', { method: 'POST', body: JSON.stringify(dados) }),
  atualizarModulo: async (id: string, dados: any) => request(`/modulos/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
  excluirModulo: async (id: string) => request(`/modulos/${id}`, { method: 'DELETE' }),

  listarSistemasBase: async (onlyActive = false) => request(`/sistemas-base?active=${onlyActive}`),
  criarSistemaBase: async (dados: any) => request('/sistemas-base', { method: 'POST', body: JSON.stringify(dados) }),
  atualizarSistemaBase: async (id: string, dados: any) => request(`/sistemas-base/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
  excluirSistemaBase: async (id: string) => request(`/sistemas-base/${id}`, { method: 'DELETE' }),
  listarModulosSistemaBase: async (id: string) => request(`/sistemas-base/${id}/modulos`),
  salvarModulosSistemaBase: async (id: string, modulos: Array<{ modulo_id: string }>) =>
    request(`/sistemas-base/${id}/modulos`, { method: 'PUT', body: JSON.stringify({ modulos }) }),

  listarTenants: async () => request('/tenants'),
  atualizarTenant: async (id: string, dados: any) => request(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
  excluirTenant: async (id: string) => request(`/tenants/${id}`, { method: 'DELETE' }),
  criarTenant: async (dados: any) => request('/tenants', { method: 'POST', body: JSON.stringify(dados) }),

  listarUsuarios: async () => request('/users'),
  criarUsuario: async (dados: any) => request('/users', { method: 'POST', body: JSON.stringify(dados) }),
  alternarStatusUsuario: async (id: string) => request(`/users/${id}/status`, { method: 'PATCH' }),
  alterarPerfilUsuario: async (id: string, dados: any) => request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify(dados) }),
};
