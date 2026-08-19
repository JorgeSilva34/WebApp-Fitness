import type { DayIntake, ISODate, Store } from './types'
import { addDays, weekEndSunday } from './date'

export const EMPTY_DAY: DayIntake = { logged: [], extraKcal: 0, extraProtein: 0 }

export function dayIntake(store: Store, date: ISODate): DayIntake {
  return store.intake[date] ?? EMPTY_DAY
}

export type DayTotals = {
  kcal: number
  protein: number
  status: 'below' | 'floor' | 'target'
  floorPct: number // 0..1 respecto al suelo
  targetPct: number // 0..1 respecto al objetivo
}

export function dayTotals(store: Store, date: ISODate): DayTotals {
  const day = dayIntake(store, date)
  let kcal = day.extraKcal
  let protein = day.extraProtein
  for (const id of day.logged) {
    const meal = store.meals.find((m) => m.id === id)
    if (meal) {
      kcal += meal.kcal
      protein += meal.protein
    }
  }
  const { kcalFloor, kcalTarget } = store.profile
  const status = kcal >= kcalTarget ? 'target' : kcal >= kcalFloor ? 'floor' : 'below'
  return {
    kcal,
    protein,
    status,
    floorPct: kcalFloor > 0 ? Math.min(1, kcal / kcalFloor) : 0,
    targetPct: kcalTarget > 0 ? Math.min(1, kcal / kcalTarget) : 0,
  }
}

/** Media móvil de 7 días de peso, alineada a cada pesaje registrado. */
export function movingAverage(
  weights: { date: ISODate; kg: number }[],
  window = 7,
): { date: ISODate; kg: number; avg: number | null }[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((w) => {
    const from = addDays(w.date, -(window - 1))
    const inWindow = sorted.filter((x) => x.date >= from && x.date <= w.date)
    return {
      ...w,
      avg: inWindow.length ? inWindow.reduce((s, x) => s + x.kg, 0) / inWindow.length : null,
    }
  })
}

export function averageIn(
  weights: { date: ISODate; kg: number }[],
  from: ISODate,
  to: ISODate,
): { avg: number | null; count: number } {
  const inWindow = weights.filter((w) => w.date >= from && w.date <= to)
  if (!inWindow.length) return { avg: null, count: 0 }
  return { avg: inWindow.reduce((s, w) => s + w.kg, 0) / inWindow.length, count: inWindow.length }
}

export type WeeklyReview =
  | { kind: 'insufficient'; weekKey: ISODate; recentCount: number; previousCount: number }
  | {
      kind: 'proposal'
      weekKey: ISODate
      deltaKg: number
      recentAvg: number
      previousAvg: number
      currentKcal: number
      proposedKcal: number
      change: number
      reason: string
    }

/** Revisión semanal: compara la media de los últimos 7 días con la de los 7
 *  anteriores. Nunca aplica nada: sólo propone. */
export function weeklyReview(store: Store, today: ISODate): WeeklyReview {
  const weekKey = lastCompletedSunday(today)
  const recentFrom = addDays(weekKey, -6)
  const prevTo = addDays(weekKey, -7)
  const prevFrom = addDays(weekKey, -13)

  const recent = averageIn(store.weights, recentFrom, weekKey)
  const previous = averageIn(store.weights, prevFrom, prevTo)

  if (recent.count < 4 || previous.count < 4 || recent.avg === null || previous.avg === null) {
    return { kind: 'insufficient', weekKey, recentCount: recent.count, previousCount: previous.count }
  }

  const deltaKg = recent.avg - previous.avg
  const currentKcal = store.profile.kcalTarget
  let change = 0
  let reason = ''
  if (deltaKg < 0.2) {
    change = 250
    reason = 'El peso sube menos de 0,2 kg por semana.'
  } else if (deltaKg <= 0.7) {
    change = 0
    reason = 'El ritmo está dentro del rango previsto (0,2–0,7 kg).'
  } else {
    change = -150
    reason = 'El peso sube más de 0,7 kg por semana.'
  }

  return {
    kind: 'proposal',
    weekKey,
    deltaKg,
    recentAvg: recent.avg,
    previousAvg: previous.avg,
    currentKcal,
    proposedKcal: currentKcal + change,
    change,
    reason,
  }
}

/** Último domingo ya cerrado (si hoy es domingo, hoy mismo). */
export function lastCompletedSunday(today: ISODate): ISODate {
  const sunday = weekEndSunday(today)
  return sunday === today ? today : addDays(sunday, -7)
}

export function adjustmentFor(store: Store, weekKey: ISODate) {
  return store.adjustments.find((a) => a.weekKey === weekKey)
}
