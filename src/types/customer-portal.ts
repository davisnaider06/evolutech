export interface CustomerAuthUser {
  id: string;
  name: string;
  email: string;
  role: 'CLIENTE';
  phone?: string | null;
  document?: string | null;
}

export interface CustomerAuthCompany {
  id: string;
  name: string;
  slug: string;
}

export interface CustomerPortalCompanyOption {
  id: string;
  name: string;
  slug: string;
}

export interface CustomerAuthResponse {
  token: string;
  customer: CustomerAuthUser;
  company: CustomerAuthCompany;
}

export interface CustomerDashboardResponse {
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  company: CustomerAuthCompany;
  summary: {
    appointments_total: number;
    upcoming_appointments: number;
    active_subscriptions: number;
    active_courses: number;
    loyalty_points: number;
    loyalty_cashback: number;
    total_services: number;
  };
}

export interface CustomerAppointment {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  professional_id?: string | null;
  professional_name?: string | null;
  scheduled_at: string;
  status: string;
  created_at: string;
}

export interface CustomerSubscription {
  id: string;
  status: string;
  start_at: string;
  end_at?: string | null;
  remaining_services?: number | null;
  auto_renew: boolean;
  amount: number;
  plan?: {
    id: string;
    name: string;
    description?: string | null;
    interval: string;
    price: number;
    included_services?: number | null;
    is_unlimited: boolean;
  } | null;
}

export interface CustomerLoyaltyResponse {
  settings: {
    points_per_service: number;
    cashback_percent: number;
    tenth_service_free: boolean;
    point_value: number;
    is_active: boolean;
  } | null;
  profile: {
    points_balance: number;
    cashback_balance: number;
    total_points_earned: number;
    total_points_redeemed: number;
    total_cashback_earned: number;
    total_cashback_used: number;
    total_services_count: number;
  } | null;
  transactions: Array<{
    id: string;
    type: string;
    points_delta: number;
    cashback_delta: number;
    amount_reference: number;
    notes?: string | null;
    created_at: string;
  }>;
}

export interface CustomerCourseAccess {
  access_id: string;
  status: string;
  start_at: string;
  end_at?: string | null;
  amount_paid: number;
  course?: {
    id: string;
    title: string;
    description?: string | null;
    price: number;
    is_active: boolean;
  } | null;
}

export interface CustomerBookingOption {
  id: string;
  name: string;
}

export interface CustomerBookingOptionsResponse {
  services: Array<CustomerBookingOption & { duration_minutes: number; price: number }>;
  professionals: CustomerBookingOption[];
}

export interface CustomerPlanCatalogItem {
  id: string;
  name: string;
  description?: string | null;
  interval: string;
  price: number;
  included_services?: number | null;
  is_unlimited: boolean;
}

export interface CustomerCourseCatalogItem {
  id: string;
  title: string;
  description?: string | null;
  price: number;
}
