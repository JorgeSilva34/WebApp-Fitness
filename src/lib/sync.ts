import type { Store } from './types'
import { normalize } from './storage'

export const SYNC_CONFIG_KEY = 'webfit.sync.v1'
export const SYNC_META_KEY = 'webfit.sync.meta.v1'

export type SyncConfig = { url: string; token: string }

/** revision: la última confirmada por el servidor. dirty: hay cambios locales
 *  sin subir (sobrevive a cerrar el navegador, para no perder nada offline). */
export type SyncMeta = { revision: number; dirty: boolean; lastSyncAt: number | null }

export const NO_META: SyncMeta = { revision: 0, dirty: false, lastSyncAt: null }

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (typeof o?.url !== 'string' || typeof o?.token !== 'string' || !o.url || !o.token) return null
    return { url: o.url, token: o.token }
  } catch {
    return null
  }
}

export function saveSyncConfig(config: SyncConfig | null): void {
  if (config) localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config))
  else localStorage.removeItem(SYNC_CONFIG_KEY)
}

export function loadSyncMeta(): SyncMeta {
  try {
    const o = JSON.parse(localStorage.getItem(SYNC_META_KEY) ?? '')
    return {
      revision: Number.isFinite(o?.revision) ? Number(o.revision) : 0,
      dirty: Boolean(o?.dirty),
      lastSyncAt: Number.isFinite(o?.lastSyncAt) ? Number(o.lastSyncAt) : null,
    }
  } catch {
    return { ...NO_META }
  }
}

export function saveSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta))
}

/** Admite «midominio.com», «https://midominio.com/api» o la ruta completa a
 *  state.php: todas acaban en el mismo sitio. */
export function endpointFor(url: string): string {
  let base = url.trim()
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`
  base = base.replace(/\/+$/, '')
  if (/\.php$/i.test(base)) return base
  if (!/\/api$/i.test(base)) base = `${base}/api`
  return `${base}/state.php`
}

export type PullResult = { revision: number; empty: boolean; store: Store; updatedAt: string | null }

export type PushResult =
  | { ok: true; revision: number }
  | { ok: false; conflict: true; revision: number; store: Store }

const TIMEOUT_MS = 15000

async function request(config: SyncConfig, init: RequestInit & { query?: string }): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(endpointFor(config.url) + (init.query ?? ''), {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    })
  } finally {
    window.clearTimeout(timer)
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.error === 'string') return body.error
  } catch {
    /* respuesta no JSON */
  }
  return `El servidor respondió ${res.status}.`
}

export async function pullState(config: SyncConfig): Promise<PullResult> {
  const res = await request(config, { method: 'GET' })
  if (!res.ok) throw new Error(await readError(res))
  const body = await res.json()
  return {
    revision: Number(body?.revision ?? 0),
    empty: Boolean(body?.empty),
    store: normalize(body?.store),
    updatedAt: typeof body?.updatedAt === 'string' ? body.updatedAt : null,
  }
}

export async function pushState(
  config: SyncConfig,
  store: Store,
  revision: number,
  force = false,
): Promise<PushResult> {
  const res = await request(config, {
    method: 'PUT',
    query: force ? '?force=1' : '',
    body: JSON.stringify({ revision, store }),
  })

  if (res.status === 409) {
    const body = await res.json()
    return { ok: false, conflict: true, revision: Number(body?.revision ?? 0), store: normalize(body?.store) }
  }
  if (!res.ok) throw new Error(await readError(res))

  const body = await res.json()
  return { ok: true, revision: Number(body?.revision ?? revision + 1) }
}
