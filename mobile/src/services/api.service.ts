// API client — wraps axios with offline detection and error handling
// All API calls go through this module.

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:3000/api/v1';

// ── API Error types ─────────────────────────────────────────────
export class OfflineError extends Error {
  constructor() { super('No internet connection'); this.name = 'OfflineError'; }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
  ) { super(message); this.name = 'ApiError'; }
}

// ── Create axios instance ───────────────────────────────────────
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 15000, // generous timeout for poor connections
    headers: { 'Accept-Encoding': 'gzip', 'Content-Type': 'application/json' },
  });

  // ── Request interceptor: attach JWT ────────────────────────────
  client.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // ── Response interceptor: normalize errors ──────────────────────
  client.interceptors.response.use(
    (res) => res,
    (error) => {
      if (!error.response) {
        // Network error — could be offline
        throw new OfflineError();
      }
      const data = error.response.data;
      if (data?.error) {
        throw new ApiError(data.error.code, data.error.message, data.error.details);
      }
      throw error;
    },
  );

  return client;
};

export const apiClient = createApiClient();

// ── Check connectivity before making requests ──────────────────
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

// ── Generic request wrapper with offline fallback ──────────────
export async function apiRequest<T>(
  config: AxiosRequestConfig,
  offlineFallback?: () => Promise<T>,
): Promise<T> {
  const online = await isOnline();

  if (!online) {
    if (offlineFallback) return offlineFallback();
    throw new OfflineError();
  }

  const response = await apiClient.request<{ success: boolean; data: T; error: any }>(config);
  if (!response.data.success) {
    throw new ApiError(
      response.data.error?.code ?? 'UNKNOWN',
      response.data.error?.message ?? 'Unknown error',
    );
  }
  return response.data.data as T;
}
