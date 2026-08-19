import type { Exercise } from './types'

const UPPER = 2.5
const LOWER = 5

export const DAY_A: Exercise[] = [
  { id: 'squat', name: 'Sentadilla trasera', sets: 3, repMin: 5, repMax: 8, kind: 'reps', increment: LOWER },
  { id: 'inc-db-press', name: 'Press inclinado con mancuernas', sets: 3, repMin: 6, repMax: 10, kind: 'reps', increment: UPPER },
  { id: 'barbell-row', name: 'Remo con barra', sets: 3, repMin: 6, repMax: 10, kind: 'reps', increment: UPPER },
  { id: 'ohp', name: 'Press militar de pie', sets: 3, repMin: 6, repMax: 10, kind: 'reps', increment: UPPER },
  { id: 'curl', name: 'Curl de bíceps', sets: 2, repMin: 8, repMax: 12, kind: 'reps', increment: UPPER },
  { id: 'calf', name: 'Elevación de gemelos', sets: 2, repMin: 10, repMax: 15, kind: 'reps', increment: UPPER },
]

export const DAY_B: Exercise[] = [
  { id: 'deadlift', name: 'Peso muerto', sets: 3, repMin: 5, repMax: 5, kind: 'reps', increment: LOWER },
  { id: 'pullup', name: 'Dominadas o jalón', sets: 3, repMin: 6, repMax: 10, kind: 'reps', increment: UPPER, bodyweight: true },
  { id: 'fly', name: 'Aperturas o cruces de poleas', sets: 3, repMin: 10, repMax: 15, kind: 'reps', increment: UPPER },
  { id: 'lunge', name: 'Zancadas o prensa', sets: 3, repMin: 8, repMax: 12, kind: 'reps', increment: LOWER },
  { id: 'dip', name: 'Fondos o extensión de tríceps', sets: 2, repMin: 8, repMax: 12, kind: 'reps', increment: UPPER, bodyweight: true },
  { id: 'ab-wheel', name: 'Rueda abdominal o plancha', sets: 3, repMin: 0, repMax: 0, kind: 'amrap', increment: 0, bodyweight: true, note: 'Series al máximo controlado, sin llegar al fallo técnico.' },
]

/** Bloque torácico: fijo al final de ambos días, no opcional. */
export const THORACIC: Exercise[] = [
  { id: 'breath', name: 'Respiración diafragmática', sets: 1, repMin: 0, repMax: 0, kind: 'time', increment: 0, bodyweight: true, note: '5 min · inspirar 4 s / espirar 6 s.' },
  { id: 'foam-ext', name: 'Expansión torácica sobre rulo', sets: 1, repMin: 0, repMax: 0, kind: 'time', increment: 0, bodyweight: true, note: '2 min.' },
  { id: 'pullover', name: 'Pullover con mancuerna ligera', sets: 2, repMin: 12, repMax: 15, kind: 'reps', increment: 0, note: 'Peso ligero: el objetivo es el rango y la respiración, no la carga.' },
  { id: 'pull-apart', name: 'Band pull-apart o face pull', sets: 2, repMin: 15, repMax: 15, kind: 'reps', increment: 0, bodyweight: true },
  { id: 'pec-stretch', name: 'Estiramiento de pectoral en puerta', sets: 1, repMin: 0, repMax: 0, kind: 'time', increment: 0, bodyweight: true, note: '30 s por lado.' },
]

export function exercisesFor(day: 'A' | 'B'): Exercise[] {
  return day === 'A' ? DAY_A : DAY_B
}

export const ALL_EXERCISES: Exercise[] = [...DAY_A, ...DAY_B, ...THORACIC]

export function exerciseById(id: string): Exercise | undefined {
  return ALL_EXERCISES.find((e) => e.id === id)
}
