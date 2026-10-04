// Thin API client for the PROMPTERA backend. Core creator features are
// local-first and do NOT use this; only auth, pricing, subscription and AI do.
import { storage } from "@/src/utils/storage";

export const TOKEN_KEY = "promptera.token";
const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export async function getToken(): Promise<string | null> {
  return storage.secureGet<string>(TOKEN_KEY, "");
}

type Options = { method?: string; body?: any; auth?: boolean; headers?: Record<string, string> };

export async function apiFetch<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = false, headers = {} } = opts;
  const token = auth ? await getToken() : null;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    const err = new Error(typeof message === "string" ? message : "Request failed") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}
