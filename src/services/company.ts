import { API_URL } from '@/config/api';

const API_COMPANY_URL = `${API_URL}/company`;

const getHeaders = () => {
  const token = localStorage.getItem('evolutech_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${API_COMPANY_URL}${path}`, {
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

  if (response.status === 204) return null;
  return response.json();
};

export const companyService = {
  financialOverview: async (params?: { dateFrom?: string; dateTo?: string; companyId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params?.companyId) searchParams.set('company_id', params.companyId);
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/financeiro/overview${suffix}`);
  },
  reportsOverview: async (params?: { dateFrom?: string; dateTo?: string; companyId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params?.companyId) searchParams.set('company_id', params.companyId);
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/reports/overview${suffix}`);
  },
  commissionsOverview: async (params?: { month?: string; professionalId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.month) searchParams.set('month', params.month);
    if (params?.professionalId) searchParams.set('professional_id', params.professionalId);
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/commissions/overview${suffix}`);
  },
  listCommissionProfiles: async () => request('/commissions/profiles'),
  upsertCommissionProfile: async (
    professionalId: string,
    data: {
      service_commission_pct: number;
      product_commission_pct: number;
      monthly_fixed_amount?: number;
      is_active?: boolean;
    }
  ) => request(`/commissions/profiles/${professionalId}`, { method: 'PUT', body: JSON.stringify(data) }),
  createCommissionAdjustment: async (data: {
    professional_id: string;
    month: string;
    amount: number;
    reason?: string;
  }) => request('/commissions/adjustments', { method: 'POST', body: JSON.stringify(data) }),
  listCommissionPayouts: async (params?: { month?: string; professionalId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.month) searchParams.set('month', params.month);
    if (params?.professionalId) searchParams.set('professional_id', params.professionalId);
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/commissions/payouts${suffix}`);
  },
  upsertCommissionPayout: async (data: {
    professional_id: string;
    month: string;
    status: 'pending' | 'paid';
    amount_paid?: number;
    note?: string;
  }) => request('/commissions/payouts', { method: 'PUT', body: JSON.stringify(data) }),
  exportCommissionsCsv: async (month?: string) => {
    const searchParams = new URLSearchParams();
    if (month) searchParams.set('month', month);
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(`${API_COMPANY_URL}/commissions/export${suffix}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Erro ${response.status}`);
    }

    return response.text();
  },
  list: async (table: string, params?: Record<string, string | number | undefined>) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      });
    }
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/${table}${suffix}`);
  },
  create: async (table: string, data: Record<string, unknown>) =>
    request(`/${table}`, { method: 'POST', body: JSON.stringify(data) }),
  update: async (table: string, id: string, data: Record<string, unknown>) =>
    request(`/${table}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: async (table: string, id: string) =>
    request(`/${table}/${id}`, { method: 'DELETE' }),
  listPdvProducts: async (search?: string) =>
    request(`/pdv/products${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  listPdvOrders: async (params?: {
    status?: string;
    limit?: number;
    page?: number;
    pageSize?: number;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/pdv/orders${suffix}`);
  },
  previewPdvLoyalty: async (data: {
    customer_name?: string;
    subtotal?: number;
    service_quantity?: number;
    manual_discount?: number;
  }) => request('/pdv/loyalty/preview', { method: 'POST', body: JSON.stringify(data) }),
  checkoutPdv: async (data: {
    customerName?: string;
    paymentMethod: 'dinheiro' | 'pix' | 'cartao' | 'credito' | 'debito';
    discount?: number;
    applyLoyalty?: boolean;
    items: Array<{ itemType: 'product' | 'service'; itemId: string; quantity: number }>;
  }) => request('/pdv/checkout', { method: 'POST', body: JSON.stringify(data) }),
  listBillingCharges: async (params?: {
    status?: string;
    page?: number;
    pageSize?: number;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.search) searchParams.set('search', params.search);
    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/billing/charges${suffix}`);
  },
  createBillingCharge: async (data: {
    title: string;
    description?: string;
    customer_name: string;
    customer_email?: string;
    customer_phone?: string;
    amount: number;
    due_date?: string;
    payment_method?: 'pix' | 'credito' | 'debito' | 'cartao';
  }) => request('/billing/charges', { method: 'POST', body: JSON.stringify(data) }),
  confirmPdvPixPayment: async (orderId: string, company_id?: string) =>
    request(`/pdv/orders/${orderId}/confirm-pix`, {
      method: 'POST',
      body: JSON.stringify(company_id ? { company_id } : {}),
    }),
  importProducts: async (products: Array<{
    name?: string;
    sku?: string | null;
    price?: number;
    stockQuantity?: number;
    isActive?: boolean;
  }>) => request('/products/import', { method: 'POST', body: JSON.stringify({ products }) }),
  listTeamMembers: async () => request('/team/members'),
  customerHistory: async (customerId: string) =>
    request(`/customers/${encodeURIComponent(customerId)}/history`),
  createTeamMember: async (data: { fullName: string; email: string; password?: string }) =>
    request('/team/members', { method: 'POST', body: JSON.stringify(data) }),
  listMyTasks: async () => request('/tasks/my'),
  createMyTask: async (data: { title: string; description?: string }) =>
    request('/tasks/my', { method: 'POST', body: JSON.stringify(data) }),
  updateMyTask: async (taskId: string, data: { title?: string; description?: string }) =>
    request(`/tasks/my/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMyTask: async (taskId: string) =>
    request(`/tasks/my/${taskId}`, { method: 'DELETE' }),
  moveMyTask: async (taskId: string, data: { status: 'todo' | 'doing' | 'done'; targetIndex?: number }) =>
    request(`/tasks/my/${taskId}/move`, { method: 'POST', body: JSON.stringify(data) }),
  listAppointmentAvailability: async (professionalId?: string) =>
    request(`/appointments/availability${professionalId ? `?professional_id=${encodeURIComponent(professionalId)}` : ''}`),
  saveAppointmentAvailability: async (
    professionalId: string,
    days: Array<{ weekday: number; start_time: string; end_time: string; is_active?: boolean }>
  ) =>
    request(`/appointments/availability/${professionalId}`, {
      method: 'PUT',
      body: JSON.stringify({ days }),
    }),
  listMyGateways: async () => request('/gateways'),
  connectGateway: async (data: {
    provedor: 'stripe' | 'mercadopago' | 'pagbank';
    nome_exibicao?: string;
    public_key?: string;
    secret_key: string;
    webhook_secret?: string;
    ambiente?: 'sandbox' | 'producao';
    webhook_url?: string;
  }) =>
    request('/gateways/connect', { method: 'POST', body: JSON.stringify(data) }),
  activateGateway: async (gatewayId: string) =>
    request(`/gateways/${gatewayId}/activate`, { method: 'POST' }),
  deleteGateway: async (gatewayId: string) =>
    request(`/gateways/${gatewayId}`, { method: 'DELETE' }),
};
