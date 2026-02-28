const API_URL = 'http://localhost:3001/api/company';

const getHeaders = () => {
  const token = localStorage.getItem('evolutech_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${API_URL}${path}`, {
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
  financialOverview: async () => request('/financeiro/overview'),
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
  checkoutPdv: async (data: {
    customerName?: string;
    paymentMethod: string;
    discount?: number;
    items: Array<{ productId: string; quantity: number }>;
  }) => request('/pdv/checkout', { method: 'POST', body: JSON.stringify(data) }),
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
  sendWhatsApp: async (data: {
    phone: string;
    message: string;
    delayMessage?: number;
    company_id?: string;
    companyId?: string;
  }) => request('/whatsapp/send', { method: 'POST', body: JSON.stringify(data) }),
};
