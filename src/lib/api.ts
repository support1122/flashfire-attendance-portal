/** Browser-side fetch wrapper. Throws ApiError carrying the server's message and status. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
      // Hard navigation on purpose: this runs outside React, and a full reload drops every cached query.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
