const COMPANY_API_URL = 'http://localhost:3001/api/company';
const PUBLIC_API_URL = 'http://localhost:3001/api/public';

const getAuthHeaders = () => {
  const token = localStorage.getItem('evolutech_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

const parseInternalAppointment = (raw: any) => ({
  id: raw.id,
  company_id: raw.companyId,
  service_id: raw.serviceId,
  professional_id: raw.professionalId,
  customer_name: raw.customerName,
  service_name: raw.serviceName,
  professional_name: raw.professionalName,
  scheduled_at: raw.scheduledAt,
  status: raw.status,
  created_at: raw.createdAt,
  updated_at: raw.updatedAt,
});

export const appointmentsService = {
  listInternal: async (params?: { page?: number; pageSize?: number; search?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);

    const response = await fetch(`${COMPANY_API_URL}/appointments?${searchParams.toString()}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro ao listar agendamentos');
    }

    const payload = await response.json();
    return {
      ...payload,
      data: Array.isArray(payload.data) ? payload.data.map(parseInternalAppointment) : [],
    };
  },

  createInternal: async (data: {
    customer_name?: string;
    service_name: string;
    professional_name?: string;
    professional_id?: string;
    service_id?: string;
    scheduled_at: string;
    status?: string;
  }) => {
    const response = await fetch(`${COMPANY_API_URL}/appointments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        serviceId: data.service_id || undefined,
        professionalId: data.professional_id || undefined,
        customerName: data.customer_name || '',
        serviceName: data.service_name,
        professionalName: data.professional_name || '',
        scheduledAt: data.scheduled_at,
        status: data.status || 'pendente',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro ao criar agendamento');
    }

    return parseInternalAppointment(await response.json());
  },

  updateInternal: async (
    id: string,
    data: {
      customer_name?: string;
      service_name?: string;
      professional_name?: string;
      professional_id?: string;
      service_id?: string;
      scheduled_at?: string;
      status?: string;
    }
  ) => {
    const response = await fetch(`${COMPANY_API_URL}/appointments/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        serviceId: data.service_id,
        professionalId: data.professional_id,
        customerName: data.customer_name,
        serviceName: data.service_name,
        professionalName: data.professional_name,
        scheduledAt: data.scheduled_at,
        status: data.status,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro ao atualizar agendamento');
    }

    return parseInternalAppointment(await response.json());
  },

  removeInternal: async (id: string) => {
    const response = await fetch(`${COMPANY_API_URL}/appointments/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro ao excluir agendamento');
    }

    return true;
  },

  getPublicBookingCompany: async (slug: string) => {
    const response = await fetch(`${PUBLIC_API_URL}/booking/${encodeURIComponent(slug)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro ao carregar empresa');
    }
    return response.json();
  },

  getPublicBookingOptions: async (slug: string) => {
    const response = await fetch(`${PUBLIC_API_URL}/booking/${encodeURIComponent(slug)}/options`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro ao carregar opcoes de agendamento');
    }
    return response.json();
  },

  listPublicAppointmentsByDate: async (slug: string, date?: string, professionalId?: string) => {
    const searchParams = new URLSearchParams();
    if (date) searchParams.set('date', date);
    if (professionalId) searchParams.set('professional_id', professionalId);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(
      `${PUBLIC_API_URL}/booking/${encodeURIComponent(slug)}/appointments${query}`
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro ao listar horarios');
    }
    return response.json();
  },

  listPublicAvailableSlots: async (
    slug: string,
    params: { date: string; service_id: string; professional_id: string }
  ) => {
    const searchParams = new URLSearchParams();
    searchParams.set('date', params.date);
    searchParams.set('service_id', params.service_id);
    searchParams.set('professional_id', params.professional_id);
    const response = await fetch(
      `${PUBLIC_API_URL}/booking/${encodeURIComponent(slug)}/slots?${searchParams.toString()}`
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro ao listar horarios disponiveis');
    }
    return response.json();
  },

  createPublicAppointment: async (
    slug: string,
    data: {
      customer_name: string;
      customer_phone?: string;
      service_id: string;
      professional_id: string;
      scheduled_at: string;
      notes?: string;
    }
  ) => {
    const response = await fetch(`${PUBLIC_API_URL}/booking/${encodeURIComponent(slug)}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erro ao criar agendamento publico');
    }

    return response.json();
  },
};
