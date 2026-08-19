import type { DayIntake, Meal, Reminder, Session, Store } from './types'
import { emptyStore } from './seed'

export const STORAGE_KEY = 'webfit.store.v1'

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)

const isISO = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** Acepta cualquier objeto y devuelve un Store válido, rellenando lo que falte.
 *  Es la única puerta de entrada de datos externos (import / localStorage). */
export function normalize(raw: unknown): Store {
  const base = emptyStore()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const p = (o.profile ?? {}) as Record<string, unknown>

  const meals: Meal[] = Array.isArray(o.meals)
    ? (o.meals as Record<string, unknown>[])
        .filter((m) => m && typeof m === 'object')
        .map((m, i) => ({
          id: str(m.id, `m${i + 1}`),
          label: str(m.label, 'Toma'),
          anchor: str(m.anchor, ''),
          kcal: Math.max(0, Math.round(num(m.kcal, 0))),
          protein: Math.max(0, Math.round(num(m.protein, 0))),
        }))
    : base.meals

  const weights = Array.isArray(o.weights)
    ? (o.weights as Record<string, unknown>[])
        .filter((w) => w && isISO(w.date) && Number.isFinite(w.kg as number))
        .map((w) => ({ date: w.date as string, kg: Number(w.kg) }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : []

  const intake: Record<string, DayIntake> = {}
  if (o.intake && typeof o.intake === 'object') {
    for (const [date, v] of Object.entries(o.intake as Record<string, unknown>)) {
      if (!isISO(date) || !v || typeof v !== 'object') continue
      const d = v as Record<string, unknown>
      intake[date] = {
        logged: Array.isArray(d.logged) ? (d.logged as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        extraKcal: Math.max(0, num(d.extraKcal, 0)),
        extraProtein: Math.max(0, num(d.extraProtein, 0)),
      }
    }
  }

  const sessions: Session[] = Array.isArray(o.sessions)
    ? (o.sessions as Record<string, unknown>[])
        .filter((s) => s && isISO(s.date) && (s.day === 'A' || s.day === 'B'))
        .map((s) => {
          const entries: Session['entries'] = {}
          if (s.entries && typeof s.entries === 'object') {
            for (const [ex, sets] of Object.entries(s.entries as Record<string, unknown>)) {
              if (!Array.isArray(sets)) continue
              entries[ex] = (sets as Record<string, unknown>[])
                .filter((x) => x && typeof x === 'object')
                .map((x) => ({ weight: Math.max(0, num(x.weight, 0)), reps: Math.max(0, Math.round(num(x.reps, 0))) }))
            }
          }
          return {
            date: s.date as string,
            day: s.day as 'A' | 'B',
            entries,
            notes: typeof s.notes === 'string' ? s.notes : undefined,
            createdAt: typeof s.createdAt === 'number' ? s.createdAt : undefined,
          }
        })
        .sort((a, b) => a.date.localeCompare(b.date))
    : []

  const adjustments: Store['adjustments'] = Array.isArray(o.adjustments)
    ? (o.adjustments as Record<string, unknown>[])
        .filter((a) => a && isISO(a.weekKey))
        .map((a) => ({
          weekKey: a.weekKey as string,
          deltaKg: num(a.deltaKg, 0),
          proposedKcal: Math.round(num(a.proposedKcal, 0)),
          previousKcal: Math.round(num(a.previousKcal, 0)),
          decision: a.decision === 'accepted' ? 'accepted' : 'dismissed',
          decidedAt: num(a.decidedAt, Date.now()),
        }))
    : []

  const reminders: Reminder[] = Array.isArray(o.reminders)
    ? (o.reminders as Record<string, unknown>[])
        .filter((r) => r && typeof r === 'object')
        .map((r, i) => ({
          id: str(r.id, `r${i + 1}`),
          label: str(r.label, 'Recordatorio'),
          time: /^\d{2}:\d{2}$/.test(String(r.time)) ? String(r.time) : '12:00',
          days: Array.isArray(r.days) ? (r.days as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6],
          enabled: r.enabled !== false,
          kind: (['meal', 'supplement', 'training', 'other'] as const).includes(r.kind as never)
            ? (r.kind as Reminder['kind'])
            : 'other',
          ...(typeof r.detail === 'string' && r.detail ? { detail: r.detail } : {}),
        }))
    : base.reminders

  return {
    version: 1,
    profile: {
      heightCm: num(p.heightCm, base.profile.heightCm),
      startWeightKg: num(p.startWeightKg, base.profile.startWeightKg),
      kcalFloor: Math.round(num(p.kcalFloor, base.profile.kcalFloor)),
      kcalTarget: Math.round(num(p.kcalTarget, base.profile.kcalTarget)),
      proteinTarget: Math.round(num(p.proteinTarget, base.profile.proteinTarget)),
    },
    meals: meals.length ? meals : base.meals,
    weights,
    intake,
    sessions,
    adjustments,
    reminders,
  }
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    return normalize(JSON.parse(raw))
  } catch {
    return emptyStore()
  }
}

/** Escritura atómica del objeto completo. */
export function saveStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (err) {
    console.error('No se pudo guardar el estado', err)
  }
}

export function exportJSON(store: Store): string {
  return JSON.stringify({ ...store, exportedAt: new Date().toISOString() }, null, 2)
}

export function parseImport(text: string): Store {
  const parsed = JSON.parse(text)
  return normalize(parsed)
}
