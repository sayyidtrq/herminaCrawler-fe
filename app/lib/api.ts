function resolveApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  } else if (process.env.NODE_ENV === "production") {
    return "http://192.168.1.3:8000";
  } else {
    return "http://localhost:8000";
  }
}

export const API_BASE_URL = resolveApiBaseUrl();

// Notified by AuthProvider so a 401 anywhere can clear React auth state
// before the hard redirect below fires.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function handleUnauthorized() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("hermina_token");
  unauthorizedHandler?.();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) || {}),
  };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("hermina_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (init?.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });

  if (response.status === 401) {
    handleUnauthorized();
  }

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      detail = payload?.error?.message ?? payload?.detail ?? detail;
    } catch {
      // Keep HTTP status text when backend does not return JSON.
    }
    throw new Error(String(detail));
  }

  const raw = await response.text();
  return (raw ? JSON.parse(raw) : {}) as T;
}

export function fetchJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function patchJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: "DELETE" });
}
