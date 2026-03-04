// Локально: по умолчанию бэкенд на :3000; можно задать VITE_API_URL в .env
export const API_BASE = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');
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
    register: (email: string, password: string) =>
      request<{ token: string; user: { id: number; email: string; role: string; hasAccess?: boolean } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: number; email: string; role: string; hasAccess?: boolean } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: { id: number; email: string; role: string; hasAccess?: boolean } }>('/auth/me'),
  },
  waterBodies: () => request<WaterBody[]>('/water-bodies'),
  waterBodyById: (id: number) => request<WaterBody>(`/water-bodies/${id}`),
  subscription: {
    plans: () => request<{ plans: { id: string; days: number; amount: string; label: string; currency: string }[] }>('/subscription/plans'),
    create: (planId: string) =>
      request<{ paymentUrl: string; paymentId: string }>('/subscription/create', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      }),
    status: () =>
      request<{
        hasAccess: boolean;
        expiresAt: string | null;
        status?: string;
      }>('/subscription/status'),
  },
  reference: () => request<ReferenceSection[]>('/reference'),
  referenceBySlug: (slug: string) => request<ReferenceSection>(`/reference/${slug}`),
  permitOrganizations: () => request<PermitOrganization[]>('/permit-organizations'),
  settings: {
    authBg: () => request<{ url: string | null }>('/settings/auth-bg'),
    logo: () => request<{ url: string | null }>('/settings/logo'),
    favicon: () => request<{ url: string | null }>('/settings/favicon'),
    pageBg: (pageKey: string) => request<{ url: string | null }>(`/settings/page-bg/${pageKey}`),
    pageInfo: () => request<Record<string, { title: string; intro: string; phone?: string; email?: string }>>('/settings/page-info'),
  },
  admin: {
    users: () => request<AdminUser[]>('/admin/users'),
    createUser: (body: { email: string; password: string; hasAccess?: boolean }) =>
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
    authBg: () => request<{ url: string | null }>('/admin/settings/auth-bg'),
    uploadAuthBg: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      return fetch(API + '/admin/settings/auth-bg', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
        return data as { url: string };
      });
    },
    deleteAuthBg: () =>
      request<{ ok: boolean }>('/admin/settings/auth-bg', { method: 'DELETE' }),
    logo: () => request<{ url: string | null }>('/admin/settings/logo'),
    uploadLogo: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return fetch(API + '/admin/settings/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      }).then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || r.statusText);
        return d as { url: string };
      });
    },
    deleteLogo: () => request<{ ok: boolean }>('/admin/settings/logo', { method: 'DELETE' }),
    favicon: () => request<{ url: string | null }>('/admin/settings/favicon'),
    uploadFavicon: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return fetch(API + '/admin/settings/favicon', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      }).then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || r.statusText);
        return d as { url: string };
      });
    },
    deleteFavicon: () => request<{ ok: boolean }>('/admin/settings/favicon', { method: 'DELETE' }),
    pageBg: (pageKey: string) => request<{ url: string | null }>(`/admin/settings/page-bg/${pageKey}`),
    uploadPageBg: (pageKey: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return fetch(API + `/admin/settings/page-bg/${pageKey}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: fd,
      }).then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || r.statusText);
        return d as { url: string };
      });
    },
    deletePageBg: (pageKey: string) =>
      request<{ ok: boolean }>(`/admin/settings/page-bg/${pageKey}`, { method: 'DELETE' }),
    pageInfo: () => request<Record<string, { title: string; intro: string; phone?: string; email?: string }>>('/admin/settings/page-info'),
    updatePageInfo: (pageKey: string, body: { title?: string; intro?: string; phone?: string; email?: string }) =>
      request<{ ok: boolean }>(`/admin/settings/page-info/${pageKey}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
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
  hasAccess?: number;
  createdAt: string;
}
