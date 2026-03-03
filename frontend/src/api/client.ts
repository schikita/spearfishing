// Локально: по умолчанию бэкенд на :3000; можно задать VITE_API_URL в .env
const API_BASE = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');
const API = API_BASE ? `${API_BASE}/api` : '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      res.status === 404
        ? 'Сервер API недоступен (404). Запустите бэкенд в отдельном терминале: из папки backend выполните npm run dev.'
        : (data.error || res.statusText || 'Ошибка запроса');
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: number; email: string; role: string; hasAccess?: boolean } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: { id: number; email: string; role: string; hasAccess?: boolean } }>('/auth/me'),
  },
  waterBodies: () => request<WaterBody[]>('/water-bodies'),
  subscription: {
    create: () => request<{ paymentUrl: string; paymentId: string }>('/subscription/create', { method: 'POST' }),
    status: () =>
      request<{ hasAccess: boolean; expiresAt: string | null; status?: string }>('/subscription/status'),
  },
  reference: () => request<ReferenceSection[]>('/reference'),
  referenceBySlug: (slug: string) => request<ReferenceSection>(`/reference/${slug}`),
  permitOrganizations: () => request<PermitOrganization[]>('/permit-organizations'),
  admin: {
    users: () => request<AdminUser[]>('/admin/users'),
    createUser: (body: { email: string; password: string; allowedIp?: string; hasAccess?: boolean }) =>
      request<{ id: number }>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUser: (id: number, body: { allowedIp?: string; password?: string; hasAccess?: boolean }) =>
      request<{ ok: boolean }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteUser: (id: number) =>
      request<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
    waterBodies: () => request<WaterBody[]>('/admin/water-bodies'),
    createWaterBody: (body: Partial<WaterBody>) =>
      request<{ id: number }>('/admin/water-bodies', { method: 'POST', body: JSON.stringify(body) }),
    updateWaterBody: (id: number, body: Partial<WaterBody>) =>
      request<{ ok: boolean }>(`/admin/water-bodies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteWaterBody: (id: number) =>
      request<{ ok: boolean }>(`/admin/water-bodies/${id}`, { method: 'DELETE' }),
    reference: () => request<ReferenceSection[]>('/admin/reference'),
    createReference: (body: { slug: string; title: string; titleRu?: string; content: string; orderIndex?: number }) =>
      request<{ id: number }>('/admin/reference', { method: 'POST', body: JSON.stringify(body) }),
    updateReference: (id: number, body: Partial<ReferenceSection>) =>
      request<{ ok: boolean }>(`/admin/reference/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteReference: (id: number) =>
      request<{ ok: boolean }>(`/admin/reference/${id}`, { method: 'DELETE' }),
    permitOrganizations: () => request<PermitOrganization[]>('/admin/permit-organizations'),
    createPermitOrg: (body: Partial<PermitOrganization>) =>
      request<{ id: number }>('/admin/permit-organizations', { method: 'POST', body: JSON.stringify(body) }),
    updatePermitOrg: (id: number, body: Partial<PermitOrganization>) =>
      request<{ ok: boolean }>(`/admin/permit-organizations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deletePermitOrg: (id: number) =>
      request<{ ok: boolean }>(`/admin/permit-organizations/${id}`, { method: 'DELETE' }),
  },
};

export interface WaterBody {
  id: number;
  name: string;
  nameRu: string | null;
  region: string;
  description: string | null;
  lat: string;
  lng: string;
  geometry?: string | null; // GeoJSON: Polygon, LineString или Point
  permitInfo: string | null;
  orderIndex: number | null;
  createdAt?: string;
}

export interface ReferenceSection {
  id: number;
  slug: string;
  title: string;
  titleRu: string | null;
  content: string;
  orderIndex: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PermitOrganization {
  id: number;
  name: string;
  nameRu: string | null;
  region: string;
  description: string | null;
  url: string | null;
  phone: string | null;
  address: string | null;
  orderIndex: number | null;
  createdAt?: string;
}

export interface AdminUser {
  id: number;
  email: string;
  role: string;
  allowedIp: string | null;
  hasAccess?: number;
  createdAt: string;
}
