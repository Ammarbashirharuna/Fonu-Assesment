import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
});

api.interceptors.request.use((c) => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401 && !String(e.config?.url).includes('/auth/')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(e);
  },
);

export const errMsg = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    const m = e.response?.data?.message;
    if (Array.isArray(m)) return m.join('; ');
    if (m) return String(m);
    if (!e.response) return 'Cannot reach the server';
  }
  return 'Something went wrong';
};

export interface Product {
  id: string; name: string; description: string | null;
  price: number; stock: number; isActive: boolean;
}
export interface OrderItem { id: string; productId: string; quantity: number; unitPrice: number }
export interface Order {
  id: string; userId: string; status: 'pending' | 'confirmed' | 'cancelled';
  total: number; createdAt: string; items: OrderItem[];
}
export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
