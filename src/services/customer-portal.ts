import { API_URL } from '@/config/api';
import {
  CustomerAppointment,
  CustomerAuthResponse,
  CustomerCourseAccess,
  CustomerDashboardResponse,
  CustomerLoyaltyResponse,
  CustomerPortalCompanyOption,
  CustomerSubscription,
} from '@/types/customer-portal';

export const CUSTOMER_TOKEN_KEY = 'evolutech_customer_token';

const customerRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ${response.status}`);
  }

  return response.json();
};

export const customerAuthService = {
  listCompanies: () => customerRequest<CustomerPortalCompanyOption[]>('/customer-auth/companies'),

  register: (payload: {
    company_slug: string;
    full_name: string;
    email: string;
    phone?: string;
    password: string;
  }) =>
    customerRequest<CustomerAuthResponse>('/customer-auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { company_slug: string; email: string; password: string }) =>
    customerRequest<CustomerAuthResponse>('/customer-auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () =>
    customerRequest<{ customer: CustomerAuthResponse['customer']; company: CustomerAuthResponse['company'] }>(
      '/customer-auth/me'
    ),
};

export const customerPortalService = {
  dashboard: () => customerRequest<CustomerDashboardResponse>('/customer/dashboard'),
  appointments: () => customerRequest<CustomerAppointment[]>('/customer/appointments'),
  cancelAppointment: (appointmentId: string) =>
    customerRequest<{ id: string; status: string; scheduled_at: string }>(
      `/customer/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      { method: 'PATCH' }
    ),
  subscriptions: () => customerRequest<CustomerSubscription[]>('/customer/subscriptions'),
  loyalty: () => customerRequest<CustomerLoyaltyResponse>('/customer/loyalty'),
  courses: () => customerRequest<CustomerCourseAccess[]>('/customer/courses'),
};
