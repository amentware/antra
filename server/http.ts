/** Small HTTP helpers shared by all Worker routes. */
import type { Context } from 'hono'
import type { ApiError } from '../shared/types'

export function json<T>(c: Context, data: T, status = 200): Response {
  return c.json(data, status as 200)
}

export function fail(c: Context, status: number, error: string, message: string, details?: unknown): Response {
  const body: ApiError = { error, message }
  if (details !== undefined) body.details = details
  return c.json(body, status as 200)
}

export function badRequest(c: Context, message: string, details?: unknown) {
  return fail(c, 400, 'bad_request', message, details)
}

export function unauthorized(c: Context, message = 'Authentication required') {
  return fail(c, 401, 'unauthorized', message)
}

export function forbidden(c: Context, message = 'Not allowed') {
  return fail(c, 403, 'forbidden', message)
}

export function notFound(c: Context, message = 'Not found') {
  return fail(c, 404, 'not_found', message)
}

export function conflict(c: Context, message: string) {
  return fail(c, 409, 'conflict', message)
}

export function tooMany(c: Context, message = 'Too many requests, slow down') {
  return fail(c, 429, 'rate_limited', message)
}

export function serverError(c: Context, message = 'Something went wrong') {
  return fail(c, 500, 'server_error', message)
}

/** Parse a JSON body defensively; returns null on malformed input. */
export async function readJson<T = unknown>(c: Context): Promise<T | null> {
  try {
    return (await c.req.json()) as T
  } catch {
    return null
  }
}
