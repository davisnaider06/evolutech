export interface CourseAdminCompany {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
}

export interface CourseAdminManager {
  id: string;
  email: string;
  role: 'COURSE_MANAGER';
}

export interface CourseAdminAuthResponse {
  token: string;
  manager: CourseAdminManager;
  company: CourseAdminCompany;
}

export interface CourseAdminCourse {
  id: string;
  company_id: string;
  title: string;
  description?: string | null;
  content_type: 'video' | 'pdf' | 'image' | 'link' | 'audio' | string;
  content_url?: string | null;
  cover_image_url?: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
