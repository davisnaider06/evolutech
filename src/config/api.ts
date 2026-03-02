const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
export const API_URL = `${API_BASE_URL}/api`;

