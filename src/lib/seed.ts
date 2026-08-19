import type { Meal, Reminder, Store } from './types'

export const SEED_MEALS: Meal[] = [
  { id: 'm1', label: 'Batido al levantarme', anchor: 'Al levantarme', kcal: 800, protein: 35 },
  { id: 'm2', label: 'Comida principal', anchor: 'Primera comida sólida', kcal: 900, protein: 40 },
  { id: 'm3', label: 'Merienda densa', anchor: 'Antes de salir a entrenar', kcal: 500, protein: 15 },
  { id: 'm4', label: 'Batido post-entreno', anchor: 'Al volver de entrenar', kcal: 700, protein: 35 },
  { id: 'm5', label: 'Cena', anchor: 'Antes de acostarme', kcal: 700, protein: 30 },
]

export const SEED_REMINDERS: Reminder[] = [
  { id: 'r1', label: 'Batido al levantarme', time: '12:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, kind: 'meal', detail: '~800 kcal · 35 g de proteína' },
  { id: 'r2', label: 'Comida principal', time: '15:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, kind: 'meal', detail: '~900 kcal · 40 g de proteína' },
  { id: 'r3', label: 'Merienda densa', time: '18:30', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, kind: 'meal', detail: '~500 kcal · 15 g de proteína' },
  { id: 'r4', label: 'Batido post-entreno', time: '21:30', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, kind: 'meal', detail: '~700 kcal · 35 g de proteína' },
  { id: 'r5', label: 'Cena', time: '00:30', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, kind: 'meal', detail: '~700 kcal · 30 g de proteína' },
  { id: 'r6', label: 'Pastillas y suplementos', time: '15:15', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, kind: 'supplement', detail: 'Con la comida' },
  { id: 'r7', label: 'Sesión de entrenamiento', time: '19:30', days: [1, 3, 5], enabled: true, kind: 'training', detail: 'Full body · alternando día A y día B' },
]

export function emptyStore(): Store {
  return {
    version: 1,
    profile: {
      heightCm: 187,
      startWeightKg: 59,
      kcalFloor: 2200,
      kcalTarget: 3200,
      proteinTarget: 120,
    },
    meals: SEED_MEALS.map((m) => ({ ...m })),
    weights: [],
    intake: {},
    sessions: [],
    adjustments: [],
    reminders: SEED_REMINDERS.map((r) => ({ ...r, days: [...r.days] })),
  }
}
