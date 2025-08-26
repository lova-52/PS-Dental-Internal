// services/auth.ts
// Gọi JWT token + lấy profile/roles hiện tại.

import * as SecureStore from 'expo-secure-store';
import { apiFetch } from './api';

export type Me = {
  id: number;
  name: string;
  email: string;
  roles: string[];  // vd: ['telesale']
};

export async function loginWP(username: string, password: string) {
  // 1) Lấy JWT token
  const tokenRes = await apiFetch('/wp-json/jwt-auth/v1/token', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    auth: false, // endpoint này không cần token
  }) as any;

  // JWT plugin thường trả { token, user_display_name, user_email, ... }
  const token = tokenRes?.token as string;
  if (!token) throw new Error('Không nhận được token');

  // Lưu token an toàn
  await SecureStore.setItemAsync('jwt_token', token);

  // 2) Lấy thông tin người dùng hiện tại (kèm roles)
  const me = await apiFetch('/wp-json/custom/v1/me', { auth: true }) as Me;

  // Lưu roles để dùng nhanh (tuỳ thích)
  await SecureStore.setItemAsync('user_roles', JSON.stringify(me.roles || []));

  return { token, me };
}

export async function logoutWP() {
  await SecureStore.deleteItemAsync('jwt_token');
  await SecureStore.deleteItemAsync('user_roles');
}

export async function getStoredAuth() {
  const token = await SecureStore.getItemAsync('jwt_token');
  const rolesStr = await SecureStore.getItemAsync('user_roles');
  const roles = rolesStr ? JSON.parse(rolesStr) as string[] : [];
  return { token, roles };
}
