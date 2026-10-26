import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEFAULT_RENDER_API_URL = 'https://invoicing-app-backend-eojw.onrender.com/api';
const FALLBACK_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_RENDER_API_URL || FALLBACK_API_URL;

async function getToken() {
  return SecureStore.getItemAsync('auth_token');
}

export async function api(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }

  return data;
}

export async function register(email: string, password: string, companyName: string) {
  return api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, companyName }),
  });
}

export async function login(email: string, password: string) {
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMyCompanies() {
  return api('/companies');
}

export async function saveSession(token: string, user: any, company: any) {
  await SecureStore.setItemAsync('auth_token', token);
  await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
  await SecureStore.setItemAsync('auth_company', JSON.stringify(company));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync('auth_token');
  await SecureStore.deleteItemAsync('auth_user');
  await SecureStore.deleteItemAsync('auth_company');
}

export async function loadSession() {
  const token = await SecureStore.getItemAsync('auth_token');
  const userRaw = await SecureStore.getItemAsync('auth_user');
  const companyRaw = await SecureStore.getItemAsync('auth_company');
  if (!token || !userRaw) return null;

  return {
    token,
    user: JSON.parse(userRaw),
    company: companyRaw ? JSON.parse(companyRaw) : null,
  };
}