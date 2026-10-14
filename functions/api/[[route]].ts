/**
 * Antra — Cloudflare Pages Function entry point.
 *
 * All requests under `/api/*` are handled by the Hono app in `server/app.ts`.
 * Routing is configured in `wrangler.toml` / the Pages dashboard with the `DB`
 * (D1) binding and the `JWT_SECRET` secret.
 */
import { handle } from 'hono/cloudflare-pages'
import { app } from '../../server/app'

export const onRequest = handle(app)
