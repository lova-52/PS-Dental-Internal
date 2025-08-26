// services/api.ts
// Helper fetch có gắn sẵn Authorization lấy từ SecureStore.
// Dùng mọi nơi thay cho fetch để đảm bảo truyền token đúng.

import * as SecureStore from 'expo-secure-store';

export const WP_BASE = 'https://nhakhoaphuongsen.com';

async function getToken() {
  return SecureStore.getItemAsync('jwt_token');
}

export type ApiOptions = RequestInit & { auth?: boolean };

export async function apiFetch(path: string, options: ApiOptions = {}) {
  const url = path.startsWith('http') ? path : `${WP_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  // Khi auth=true, tự chèn Bearer token
  if (options.auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  // Tự convert lỗi dễ đọc
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt}`);
  }
  // Nếu không có body (204) thì trả null
  if (res.status === 204) return null;
  // Thử parse JSON; nếu fail thì trả text
  try { return await res.json(); } catch { return await res.text(); }
}
