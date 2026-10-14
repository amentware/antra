/**
 * Antra — API client. All requests are same-origin with the session cookie.
 */
import type { Account, Budget, Category, Expense, SettingsRow, SyncPullResponse, UserProfile } from '@shared/types'

export class HttpError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }

  get isNetwork(): boolean {
    return this.status === 0
  }
  get isAuth(): boolean {
    return this.status === 401
  }
}

async function toHttpError(res: Response): Promise<HttpError> {
  let code = `http_${res.status}`
  let message = res.statusText || 'Request failed'
  let details: unknown
  try {
    const body = (await res.json()) as { error?: string; message?: string; details?: unknown }
    if (body?.error) code = body.error
    if (body?.message) message = body.message
    details = body?.details
  } catch {
    /* non-JSON body */
  }
  return new HttpError(res.status, code, message, details)
}

interface RequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = options.timeoutMs ?? 20000
  const timer = setTimeout(() => controller.abort(), timeout)
  if (options.signal) options.signal.addEventListener('abort', () => controller.abort(), { once: true })

  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    throw new HttpError(0, 'network_error', controller.signal.aborted ? 'Request timed out' : 'You appear to be offline')
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) throw await toHttpError(res)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(res.status, 'bad_json', 'Unexpected response from server')
  }
}

export interface SyncOpPayload {
  table: string
  op: 'upsert' | 'delete'
  row: Record<string, unknown>
}

export interface PushResult {
  applied: number
  errors: Array<{ index: number; table: string; message: string }>
  cursor: string
}

export const api = {
  authStatus: () => request<{ setup_required: boolean; registration_open: boolean }>('GET', '/api/auth/status'),

  setup: (input: { email: string; password: string; name: string }) =>
    request<{ user: UserProfile }>('POST', '/api/auth/setup', input),

  login: (input: { email: string; password: string }) => request<{ user: UserProfile }>('POST', '/api/auth/login', input),

  logout: () => request<{ ok: boolean }>('POST', '/api/auth/logout', {}),

  me: () => request<{ user: UserProfile }>('GET', '/api/auth/me'),

  pull: (since: string) => request<SyncPullResponse>('GET', `/api/sync?since=${encodeURIComponent(since)}`, undefined, { timeoutMs: 30000 }),

  push: (ops: SyncOpPayload[]) => request<PushResult>('POST', '/api/sync', { ops }, { timeoutMs: 30000 }),

  listTokens: () =>
    request<{ tokens: ApiTokenRow[] }>('GET', '/api/tokens'),

  createToken: (name: string) =>
    request<{ token: ApiTokenRow; plaintext: string }>('POST', '/api/tokens', { name }),

  revokeToken: (id: string) => request<{ ok: boolean }>('DELETE', `/api/tokens/${encodeURIComponent(id)}`),
}

export interface ApiTokenRow {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export type { Account, Budget, Category, Expense, SettingsRow, SyncPullResponse, UserProfile }

/** Best-effort online check used by the UI (never blocks a write). */
export function isProbablyOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}
