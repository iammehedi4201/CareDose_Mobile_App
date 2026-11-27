import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const AUTH_SESSION_STORAGE_KEY = 'caredose:auth-session:v1';

export interface SavedAuthSession {
  token: string;
  activePatientId: string;
}

export async function readSavedAuthSession(): Promise<SavedAuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; activePatientId?: string };
    if (parsed.token && parsed.activePatientId) {
      return { token: parsed.token, activePatientId: parsed.activePatientId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearSavedAuthSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}

export class ApiRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly isNetworkError = false,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured && configured.length > 0) {
    return configured.replace(/\/+$/, '');
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri && typeof hostUri === 'string') {
    const host = hostUri.split(':')[0]?.trim();
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:3000/api/v1`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api/v1';
  }

  return 'http://localhost:3000/api/v1';
}

export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;
  const { timeoutMs = 15000, headers, ...fetchOptions } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    const rawText = await response.text();
    let parsed: unknown = null;
    if (rawText.length > 0) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      const msg =
        parsed &&
        typeof parsed === 'object' &&
        'message' in parsed &&
        typeof (parsed as { message: unknown }).message === 'string'
          ? (parsed as { message: string }).message
          : `Request failed with HTTP ${response.status}`;
      throw new ApiRequestError(response.status, msg, false);
    }

    return parsed as T;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
      throw new ApiRequestError(
        0,
        'The server took too long to respond. Tap Retry to try again.',
        true,
      );
    }
    const detail = error instanceof Error ? error.message : 'Network error';
    throw new ApiRequestError(0, `Unable to reach CareDose API (${detail}).`, true);
  } finally {
    clearTimeout(timer);
  }
}
