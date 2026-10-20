import axios, { AxiosError } from 'axios';
import type { ApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tdcp_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original.headers['X-Retry']) {
      const refresh = localStorage.getItem('tdcp_refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
            `${API_BASE}/auth/refresh`,
            { refreshToken: refresh }
          );
          localStorage.setItem('tdcp_access_token', data.data.accessToken);
          localStorage.setItem('tdcp_refresh_token', data.data.refreshToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          original.headers['X-Retry'] = '1';
          return api(original);
        } catch {
          localStorage.removeItem('tdcp_access_token');
          localStorage.removeItem('tdcp_refresh_token');
        }
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}
