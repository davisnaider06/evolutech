import { API_URL } from '@/config/api';
import { CourseAdminAuthResponse, CourseAdminCompany, CourseAdminCourse } from '@/types/course-admin';

export const COURSE_ADMIN_TOKEN_KEY = 'evolutech_course_admin_token';

const request = async <T>(path: string, init?: RequestInit, useToken = false): Promise<T> => {
  const token = useToken ? localStorage.getItem(COURSE_ADMIN_TOKEN_KEY) : null;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Erro ${response.status}`);
  }
  return response.json();
};

export const courseAdminAuthService = {
  listCompanies: () => request<CourseAdminCompany[]>('/course-auth/companies'),
  register: (payload: { company_slug: string; email: string; password: string }) =>
    request<CourseAdminAuthResponse>('/course-auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { company_slug: string; email: string; password: string }) =>
    request<CourseAdminAuthResponse>('/course-auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () =>
    request<{ manager: CourseAdminAuthResponse['manager']; company: CourseAdminAuthResponse['company'] }>(
      '/course-auth/me',
      undefined,
      true
    ),
};

export const courseAdminService = {
  listCourses: () => request<CourseAdminCourse[]>('/course-admin/courses', undefined, true),
  createCourse: (payload: {
    title: string;
    description?: string;
    content_type: string;
    content_url: string;
    cover_image_url?: string;
    price: number;
    is_active?: boolean;
  }) =>
    request<CourseAdminCourse>('/course-admin/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, true),
  updateCourse: (courseId: string, payload: Partial<{
    title: string;
    description?: string;
    content_type: string;
    content_url: string;
    cover_image_url?: string;
    price: number;
    is_active: boolean;
  }>) =>
    request<CourseAdminCourse>(`/course-admin/courses/${encodeURIComponent(courseId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, true),
  deleteCourse: (courseId: string) =>
    request<{ ok: boolean }>(`/course-admin/courses/${encodeURIComponent(courseId)}`, {
      method: 'DELETE',
    }, true),
};
