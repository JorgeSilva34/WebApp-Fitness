import type { Exercise, ISODate, SetEntry, Session, Store } from './types'

export type Proposal = {
  sets: SetEntry[]
  reason: string
  kind: 'first' | 'add-rep' | 'add-weight' | 'repeat'
  lastDate?: ISODate
  lastSets?: SetEntry[]
}

export function lastSessionWith(store: Store, exerciseId: string, beforeDate?: ISODate) {
  const candidates = store.sessions
    .filter((s) => s.entries[exerciseId]?.length && (!beforeDate || s.date < beforeDate))
    .sort((a, b) => b.date.localeCompare(a.date))
  return candidates[0]
}

/** Propuesta de hoy a partir de la última sesión registrada (doble progresión).
 *  Nunca propone fallo ni series de una repetición máxima. */
export function proposeFor(store: Store, ex: Exercise, beforeDate?: ISODate): Proposal {
  const last = lastSessionWith(store, ex.id, beforeDate)

  if (ex.kind === 'time') {
    return { sets: [], reason: ex.note ?? 'Bloque de movilidad y respiración.', kind: 'repeat', lastDate: last?.date }
  }

  if (!last) {
    const reps = ex.kind === 'amrap' ? 0 : ex.repMin
    return {
      sets: Array.from({ length: ex.sets }, () => ({ weight: 0, reps })),
      reason:
        ex.kind === 'amrap'
          ? 'Primera vez: series controladas, parando 2-3 repeticiones antes del fallo.'
          : `Primera vez: empieza en ${ex.repMin} repeticiones dejando 2-3 en recámara.`,
      kind: 'first',
    }
  }

  const lastSets = last.entries[ex.id]
  const padded: SetEntry[] = Array.from({ length: ex.sets }, (_, i) => ({
    ...(lastSets[i] ?? lastSets[lastSets.length - 1]),
  }))

  if (ex.kind === 'amrap') {
    return {
      sets: padded.map((s) => ({ weight: s.weight, reps: s.reps + 1 })),
      reason: 'Intenta una repetición más que la última vez, sin llegar al fallo.',
      kind: 'add-rep',
      lastDate: last.date,
      lastSets,
    }
  }

  const topWeight = Math.max(...padded.map((s) => s.weight))
  const allAtTop = padded.every((s) => s.reps >= ex.repMax && s.weight >= topWeight)

  if (allAtTop && ex.increment > 0) {
    const next = round(topWeight + ex.increment)
    return {
      sets: padded.map(() => ({ weight: next, reps: ex.repMin })),
      reason: `Todas las series llegaron a ${ex.repMax}: sube a ${fmt(next)} kg y vuelve a ${ex.repMin} repeticiones.`,
      kind: 'add-weight',
      lastDate: last.date,
      lastSets,
    }
  }

  const idx = padded.findIndex((s) => s.reps < ex.repMax)
  if (idx === -1) {
    return {
      sets: padded,
      reason: 'Repite la última sesión manteniendo la técnica y el rango.',
      kind: 'repeat',
      lastDate: last.date,
      lastSets,
    }
  }

  const sets = padded.map((s, i) => (i === idx ? { ...s, reps: s.reps + 1 } : { ...s }))
  return {
    sets,
    reason: `Mismo peso, una repetición más en la serie ${idx + 1} (${padded[idx].reps} → ${padded[idx].reps + 1}).`,
    kind: 'add-rep',
    lastDate: last.date,
    lastSets,
  }
}

/** Día sugerido: alterna respecto a la última sesión registrada (A-B-A / B-A-B). */
export function suggestedDay(store: Store): 'A' | 'B' {
  const last = [...store.sessions].sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!last) return 'A'
  return last.day === 'A' ? 'B' : 'A'
}

export function sessionVolume(session: Session): number {
  let total = 0
  for (const sets of Object.values(session.entries)) {
    for (const s of sets) total += s.weight * s.reps
  }
  return Math.round(total)
}

export function topSet(sets: SetEntry[] | undefined): SetEntry | null {
  if (!sets?.length) return null
  return [...sets].sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0]
}

const round = (n: number) => Math.round(n * 100) / 100
export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))
