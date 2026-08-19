import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ISODate, Store } from './types'
import { loadStore, saveStore } from './storage'
import { emptyStore } from './seed'
import { EMPTY_DAY } from './nutrition'
import {
  NO_META,
  loadSyncConfig,
  loadSyncMeta,
  pullState,
  pushState,
  saveSyncConfig,
  saveSyncMeta,
} from './sync'
import type { SyncConfig, SyncMeta } from './sync'

/** off: sin servidor configurado · idle: al día · syncing: enviando o trayendo
 *  pending: cambios locales por subir · offline: sin conexión, se reintenta
 *  conflict: otro dispositivo escribió antes · error: el servidor respondió mal */
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'pending' | 'offline' | 'conflict' | 'error'

export type SyncView = {
  config: SyncConfig | null
  status: SyncStatus
  error: string | null
  lastSyncAt: number | null
  revision: number
  configure: (config: SyncConfig | null) => void
  syncNow: () => void
  keepLocal: () => void
  takeServer: () => void
}

type Ctx = {
  store: Store
  update: (fn: (draft: Store) => Store) => void
  replace: (next: Store) => void
  reset: () => void
  toggleMeal: (date: ISODate, mealId: string) => void
  setExtra: (date: ISODate, kcal: number, protein: number) => void
  setWeight: (date: ISODate, kg: number | null) => void
  sync: SyncView
}

const StoreContext = createContext<Ctx | null>(null)

const PUSH_DEBOUNCE_MS = 1500
const RETRY_EVERY_MS = 60_000

function hasData(store: Store): boolean {
  return store.weights.length > 0 || store.sessions.length > 0 || Object.keys(store.intake).length > 0
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(() => loadStore())
  const [config, setConfig] = useState<SyncConfig | null>(() => loadSyncConfig())
  const [meta, setMetaState] = useState<SyncMeta>(() => loadSyncMeta())
  const [status, setStatus] = useState<SyncStatus>(() => (loadSyncConfig() ? 'syncing' : 'off'))
  const [error, setError] = useState<string | null>(null)

  const storeRef = useRef(store)
  const configRef = useRef(config)
  const metaRef = useRef(meta)
  const adopting = useRef(false)
  const pushTimer = useRef<number | null>(null)
  const started = useRef(false)
  const mounted = useRef(false)
  const statusRef = useRef(status)
  const serverCopy = useRef<{ store: Store; revision: number } | null>(null)

  storeRef.current = store
  configRef.current = config
  metaRef.current = meta
  statusRef.current = status

  const setMeta = useCallback((next: SyncMeta) => {
    metaRef.current = next
    saveSyncMeta(next)
    setMetaState(next)
  }, [])

  // --- envío al servidor -------------------------------------------------

  const push = useCallback(
    async (force = false): Promise<void> => {
      const cfg = configRef.current
      if (!cfg) return
      setStatus('syncing')
      setError(null)
      try {
        const result = await pushState(cfg, storeRef.current, metaRef.current.revision, force)
        if (result.ok) {
          setMeta({ revision: result.revision, dirty: false, lastSyncAt: Date.now() })
          serverCopy.current = null
          setStatus('idle')
        } else {
          serverCopy.current = { store: result.store, revision: result.revision }
          setStatus('conflict')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setStatus(navigator.onLine ? 'error' : 'offline')
      }
    },
    [setMeta],
  )

  const schedulePush = useCallback(() => {
    if (!configRef.current) return
    if (pushTimer.current !== null) window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => {
      pushTimer.current = null
      void push()
    }, PUSH_DEBOUNCE_MS)
  }, [push])

  const adopt = useCallback(
    (next: Store, revision: number) => {
      adopting.current = true
      setStore(next)
      saveStore(next)
      setMeta({ revision, dirty: false, lastSyncAt: Date.now() })
      serverCopy.current = null
      setStatus('idle')
    },
    [setMeta],
  )

  // --- guardado local: siempre, con o sin servidor -----------------------

  useEffect(() => {
    saveStore(store)
    if (!mounted.current) {
      // primer render: lo cargado de localStorage no es un cambio del usuario
      mounted.current = true
      return
    }
    if (adopting.current) {
      adopting.current = false
      return
    }
    if (!configRef.current) return
    setMeta({ ...metaRef.current, dirty: true })
    setStatus((s) => (s === 'conflict' ? s : 'pending'))
    schedulePush()
  }, [store, schedulePush, setMeta])

  // --- primera sincronización -------------------------------------------

  const firstSync = useCallback(async () => {
    const cfg = configRef.current
    if (!cfg) return
    setStatus('syncing')
    setError(null)
    try {
      const pulled = await pullState(cfg)
      if (pulled.empty) {
        // Base de datos recién creada: sube lo que haya en este dispositivo.
        metaRef.current = { ...metaRef.current, revision: pulled.revision }
        await push(true)
        return
      }
      if (metaRef.current.dirty) {
        if (metaRef.current.revision === pulled.revision) {
          await push()
        } else {
          serverCopy.current = { store: pulled.store, revision: pulled.revision }
          setStatus('conflict')
        }
        return
      }
      adopt(pulled.store, pulled.revision)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus(navigator.onLine ? 'error' : 'offline')
    }
  }, [adopt, push])

  useEffect(() => {
    if (started.current || !config) return
    started.current = true
    void firstSync()
  }, [config, firstSync])

  // --- reintentos: al recuperar conexión, al volver a la app y por reloj --

  useEffect(() => {
    const retry = () => {
      if (!configRef.current || !metaRef.current.dirty) return
      if (statusRef.current === 'syncing' || statusRef.current === 'conflict') return
      void push()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') retry()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(retry, RETRY_EVERY_MS)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [push])

  // --- acciones ----------------------------------------------------------

  const update = useCallback((fn: (draft: Store) => Store) => setStore((s) => fn(structuredClone(s))), [])
  const replace = useCallback((next: Store) => setStore(next), [])
  const reset = useCallback(() => setStore(emptyStore()), [])

  const toggleMeal = useCallback(
    (date: ISODate, mealId: string) =>
      update((s) => {
        const day = s.intake[date] ?? { ...EMPTY_DAY, logged: [] }
        const logged = day.logged.includes(mealId)
          ? day.logged.filter((id) => id !== mealId)
          : [...day.logged, mealId]
        s.intake[date] = { ...day, logged }
        return s
      }),
    [update],
  )

  const setExtra = useCallback(
    (date: ISODate, kcal: number, protein: number) =>
      update((s) => {
        const day = s.intake[date] ?? { ...EMPTY_DAY, logged: [] }
        s.intake[date] = { ...day, extraKcal: Math.max(0, kcal), extraProtein: Math.max(0, protein) }
        return s
      }),
    [update],
  )

  const setWeight = useCallback(
    (date: ISODate, kg: number | null) =>
      update((s) => {
        s.weights = s.weights.filter((w) => w.date !== date)
        if (kg !== null && Number.isFinite(kg) && kg > 0) s.weights.push({ date, kg })
        s.weights.sort((a, b) => a.date.localeCompare(b.date))
        return s
      }),
    [update],
  )

  const configure = useCallback(
    (next: SyncConfig | null) => {
      saveSyncConfig(next)
      setConfig(next)
      configRef.current = next
      started.current = false
      serverCopy.current = null
      setError(null)
      if (!next) {
        setMeta({ ...NO_META })
        setStatus('off')
        return
      }
      // Al conectar por primera vez, lo que haya en el móvil cuenta como pendiente.
      setMeta({ revision: 0, dirty: hasData(storeRef.current), lastSyncAt: null })
      setStatus('syncing')
    },
    [setMeta],
  )

  const syncNow = useCallback(() => {
    if (!configRef.current) return
    started.current = true
    void firstSync()
  }, [firstSync])

  const keepLocal = useCallback(() => void push(true), [push])

  const takeServer = useCallback(() => {
    const copy = serverCopy.current
    if (copy) adopt(copy.store, copy.revision)
  }, [adopt])

  const sync = useMemo<SyncView>(
    () => ({
      config,
      status,
      error,
      lastSyncAt: meta.lastSyncAt,
      revision: meta.revision,
      configure,
      syncNow,
      keepLocal,
      takeServer,
    }),
    [config, status, error, meta.lastSyncAt, meta.revision, configure, syncNow, keepLocal, takeServer],
  )

  const value = useMemo<Ctx>(
    () => ({ store, update, replace, reset, toggleMeal, setExtra, setWeight, sync }),
    [store, update, replace, reset, toggleMeal, setExtra, setWeight, sync],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore fuera de StoreProvider')
  return ctx
}
