export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function http<T>(path: string, options?: { method?: HttpMethod; body?: unknown; headers?: Record<string, string> }): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {})
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include'
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function http<T>(path: string, options?: { method?: HttpMethod; body?: unknown; headers?: Record<string, string> }): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {})
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include'
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}


