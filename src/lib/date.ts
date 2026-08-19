import type { ISODate } from './types'

export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Día "de uso": el horario del usuario es tardío, así que hasta las 05:00 se
 *  sigue considerando el día anterior. Evita que una cena a las 03:00 cuente en
 *  la jornada equivocada. */
export const DAY_ROLLOVER_HOUR = 5

export function todayISO(now: Date = new Date()): ISODate {
  const d = new Date(now)
  if (d.getHours() < DAY_ROLLOVER_HOUR) d.setDate(d.getDate() - 1)
  return toISO(d)
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000)
}

const LONG = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const SHORT = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' })

export function formatLong(iso: ISODate): string {
  return LONG.format(fromISO(iso))
}

export function formatShort(iso: ISODate): string {
  return SHORT.format(fromISO(iso))
}

/** Domingo de la semana a la que pertenece la fecha (semana termina en domingo). */
export function weekEndSunday(iso: ISODate): ISODate {
  const d = fromISO(iso)
  const delta = (7 - d.getDay()) % 7
  return addDays(iso, delta)
}
