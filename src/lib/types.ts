export type ISODate = string // YYYY-MM-DD

export type Meal = {
  id: string
  label: string // "Batido al levantarme"
  anchor: string // "Al levantarme" — evento, no hora
  kcal: number
  protein: number
}

export type DayIntake = {
  logged: string[] // ids de Meal marcados
  extraKcal: number
  extraProtein: number
}

export type SetEntry = { weight: number; reps: number }

export type Session = {
  date: ISODate
  day: 'A' | 'B'
  entries: Record<string, SetEntry[]> // clave = exerciseId
  notes?: string
  createdAt?: number
}

export type Profile = {
  heightCm: number
  startWeightKg: number
  kcalFloor: number
  kcalTarget: number
  proteinTarget: number
}

/** Decisión tomada sobre una propuesta de ajuste semanal. */
export type Adjustment = {
  weekKey: string // domingo de la semana evaluada, ISO
  deltaKg: number
  proposedKcal: number
  previousKcal: number
  decision: 'accepted' | 'dismissed'
  decidedAt: number
}

/** Recordatorio: la app sólo guarda la configuración; el envío al móvil lo hace
 *  la automatización externa (ver notify/). */
export type Reminder = {
  id: string
  label: string
  time: string // HH:MM local
  days: number[] // 0=domingo … 6=sábado
  enabled: boolean
  kind: 'meal' | 'supplement' | 'training' | 'other'
  detail?: string // texto secundario del aviso, p. ej. "~800 kcal · 35 g"
}

export type Store = {
  version: 1
  profile: Profile
  meals: Meal[]
  weights: { date: ISODate; kg: number }[]
  intake: Record<ISODate, DayIntake>
  sessions: Session[]
  adjustments: Adjustment[]
  reminders: Reminder[]
}

// ---- Plan de entrenamiento (datos semilla, no editables desde la app) ----

export type ExerciseKind = 'reps' | 'amrap' | 'time'

export type Exercise = {
  id: string
  name: string
  sets: number
  repMin: number
  repMax: number
  kind: ExerciseKind
  increment: number // kg a sumar al progresar
  note?: string
  bodyweight?: boolean // permite registrar con carga 0
}
