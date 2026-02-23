const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
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
  if (!res.ok) throw new Error(data.error || res.statusText || 'Ошибка запроса');
  return data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: number; email: string; role: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: { id: number; email: string; role: string } }>('/auth/me'),
  },
  waterBodies: () => request<WaterBody[]>('/water-bodies'),
  reference: () => request<ReferenceSection[]>('/reference'),
  referenceBySlug: (slug: string) => request<ReferenceSection>(`/reference/${slug}`),
  permitOrganizations: () => request<PermitOrganization[]>('/permit-organizations'),
  admin: {
    users: () => request<AdminUser[]>('/admin/users'),
    createUser: (body: { email: string; password: string; allowedIp?: string }) =>
      request<{ id: number }>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUser: (id: number, body: { allowedIp?: string; password?: string }) =>
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
  createdAt: string;
}
