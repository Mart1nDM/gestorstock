import { supabase } from "./supabase";

const API_URL = (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "").replace("http://localhost:", "http://127.0.0.1:");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(options.headers);
  const method = (options.method || "GET").toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && method !== "GET" && method !== "HEAD" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "detail" in body
      ? String((body as { detail?: unknown }).detail)
      : "No se pudo completar la operacion.";
    throw new ApiError(message, response.status);
  }

  return body as T;
}

