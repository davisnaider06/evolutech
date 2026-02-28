import { API_URL } from '@/config/api';
import {
  CustomerAppointment,
  CustomerAuthResponse,
  CustomerAvailableSlotsResponse,
  CustomerBookingOptionsResponse,
  CustomerCourseCatalogItem,
  CustomerCourseAccess,
  CustomerDashboardResponse,
  CustomerLoyaltyResponse,
  CustomerPlanCatalogItem,
  CustomerSubscriptionPurchaseResult,
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
  bookingOptions: () => customerRequest<CustomerBookingOptionsResponse>('/customer/booking-options'),
  appointments: () => customerRequest<CustomerAppointment[]>('/customer/appointments'),
  appointmentSlots: (params: { date: string; service_id: string; professional_id: string }) => {
    const search = new URLSearchParams({
      date: params.date,
      service_id: params.service_id,
      professional_id: params.professional_id,
    }).toString();
    return customerRequest<CustomerAvailableSlotsResponse>(`/customer/appointments/slots?${search}`);
  },
  createAppointment: (payload: { service_id: string; professional_id: string; scheduled_at: string }) =>
    customerRequest<{
      id: string;
      scheduled_at: string;
      status: string;
      service_name: string;
      professional_name: string;
    }>('/customer/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelAppointment: (appointmentId: string) =>
    customerRequest<{ id: string; status: string; scheduled_at: string }>(
      `/customer/appointments/${encodeURIComponent(appointmentId)}/cancel`,
      { method: 'PATCH' }
    ),
  plans: () => customerRequest<CustomerPlanCatalogItem[]>('/customer/plans'),
  subscribePlan: (planId: string, payload: { payment_method: 'pix' | 'credito' | 'debito' | 'cartao' }) =>
    customerRequest<CustomerSubscriptionPurchaseResult>(
      `/customer/subscriptions/${encodeURIComponent(planId)}/subscribe`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  subscriptions: () => customerRequest<CustomerSubscription[]>('/customer/subscriptions'),
  loyalty: () => customerRequest<CustomerLoyaltyResponse>('/customer/loyalty'),
  availableCourses: () => customerRequest<CustomerCourseCatalogItem[]>('/customer/courses/available'),
  purchaseCourse: (courseId: string) =>
    customerRequest<{ access_id: string; status: string; start_at: string }>(
      `/customer/courses/${encodeURIComponent(courseId)}/purchase`,
      { method: 'POST' }
    ),
  courses: () => customerRequest<CustomerCourseAccess[]>('/customer/courses'),
};
