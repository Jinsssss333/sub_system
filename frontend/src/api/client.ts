/**
 * Thin fetch wrapper for the Brightloop API.
 * - Adds the Bearer token
 * - Unwraps the `{ error: { code, message, fields } }` envelope into ApiError
 * - Signs the user out on 401
 * There is no mock or offline fallback: every screen shows real database data.
 */
const TOKEN_KEY = 'brightloop.token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

export async function parseError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null;
  const fallback = response.status >= 500 ? 'The server had a problem. Please try again.' : `Request failed (${response.status})`;
  return new ApiError(response.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? fallback, body?.error?.fields ?? {});
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function buildQuery(query?: Query) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const token = tokenStore.get();
  let response: Response;
  try {
    response = await fetch(`/api${path}${buildQuery(query)}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the Brightloop API. Is the backend running on port 4000?');
  }
  if (response.status === 401 && token) onUnauthorized();
  if (!response.ok) throw await parseError(response);
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  /** Fetches the server-rendered (HTML-escaped) invoice and opens it in a new tab for printing. */
  async openInvoicePrint(invoiceId: string) {
    const win = window.open('', '_blank');
    const token = tokenStore.get();
    const response = await fetch(`/api/invoices/${invoiceId}/print`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) {
      win?.close();
      throw await parseError(response);
    }
    const url = URL.createObjectURL(new Blob([await response.text()], { type: 'text/html' }));
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}
export interface One<T> {
  data: T;
}
