// Programa en ntfy.sh los avisos del día siguiente al arranque del día.
//
// Se ejecuta una vez al día (ver .github/workflows/reminders.yml). En lugar de
// depender de la puntualidad del cron de GitHub —que se retrasa con frecuencia—
// deja cada aviso *programado en el servidor de ntfy* con la cabecera X-At, así
// que llega a la hora exacta aunque la ejecución se haya retrasado.
//
// Uso:
//   node notify/send.mjs                 → programa la ventana del día
//   node notify/send.mjs --dry-run       → sólo imprime lo que enviaría
//   node notify/send.mjs --test          → un aviso inmediato de prueba
//
// Variables de entorno:
//   NTFY_TOPIC   (obligatoria si no está en reminders.json) nombre del topic
//   NTFY_SERVER  (opcional) por defecto https://ntfy.sh
//   NTFY_TOKEN   (opcional) token de acceso si el topic está protegido

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(join(here, 'reminders.json'), 'utf8'))

// Si hay API configurada, los avisos salen de la base de datos: así basta con
// editar las horas en Ajustes y no hay que tocar el repositorio.
function apiEndpoint(url) {
  let base = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`
  if (/\.php$/i.test(base)) return base
  if (!/\/api$/i.test(base)) base = `${base}/api`
  return `${base}/state.php`
}

if (process.env.API_URL && process.env.API_TOKEN) {
  try {
    const res = await fetch(apiEndpoint(process.env.API_URL), {
      headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
    })
    if (!res.ok) throw new Error(`respuesta ${res.status}`)
    const body = await res.json()
    const remote = body?.store?.reminders
    if (Array.isArray(remote) && remote.length) {
      config.reminders = remote
      console.log(`Recordatorios leídos de la base de datos (revisión ${body.revision}).`)
    } else {
      console.log('La base de datos no tiene recordatorios: se usa notify/reminders.json.')
    }
  } catch (e) {
    console.log(`No se pudo leer la API (${e.message}): se usa notify/reminders.json.`)
  }
}

const TZ = config.timezone || 'Atlantic/Canary'
const DAY_START = Number.isInteger(config.dayStartHour) ? config.dayStartHour : 6
const SERVER = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '')
const TOPIC = process.env.NTFY_TOPIC || config.topic
const TOKEN = process.env.NTFY_TOKEN || ''

const dryRun = process.argv.includes('--dry-run')
const testMode = process.argv.includes('--test')

if (!TOPIC) {
  console.error('Falta el topic de ntfy: define NTFY_TOPIC o el campo "topic" en notify/reminders.json.')
  process.exit(1)
}

// --- Conversión de hora local (con zona horaria) a UTC, sin dependencias ---

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function zonedParts(date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]))
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  }
}

/** Desfase de la zona respecto a UTC, en ms, para un instante dado. */
function offsetMs(date) {
  const p = zonedParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Instante UTC correspondiente a una fecha y hora locales de la zona. */
function zonedToUtc(year, month, day, hour, minute) {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  let utc = guess - offsetMs(new Date(guess))
  utc = guess - offsetMs(new Date(utc)) // segunda pasada: cubre los cambios de hora
  return new Date(utc)
}

function addLocalDays(base, n) {
  const d = new Date(Date.UTC(base.year, base.month - 1, base.day))
  d.setUTCDate(d.getUTCDate() + n)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() }
}

// --- Ventana del día: [hoy dayStart, mañana dayStart) en hora local ---

const now = new Date()
const localNow = zonedParts(now)
const todayBase = addLocalDays(localNow, localNow.hour < DAY_START ? -1 : 0)
const windowStart = zonedToUtc(todayBase.year, todayBase.month, todayBase.day, DAY_START, 0)
const windowEnd = new Date(windowStart.getTime() + 24 * 3600 * 1000)

const ICON = { meal: '🍽️', supplement: '💊', training: '🏋️', other: '🔔' }
const TAG = { meal: 'fork_and_knife', supplement: 'pill', training: 'weight_lifting', other: 'bell' }

function occurrences(reminder) {
  const [hh, mm] = String(reminder.time).split(':').map(Number)
  const out = []
  for (const offset of [0, 1]) {
    const base = addLocalDays(todayBase, offset)
    if (!reminder.days.includes(base.weekday)) continue
    const at = zonedToUtc(base.year, base.month, base.day, hh, mm)
    if (at >= windowStart && at < windowEnd) out.push(at)
  }
  return out
}

async function post(headers, body) {
  const res = await fetch(`${SERVER}/${TOPIC}`, {
    method: 'POST',
    headers: { ...headers, ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body,
  })
  if (!res.ok) throw new Error(`ntfy respondió ${res.status}: ${await res.text()}`)
}

const hhmm = (d) => {
  const p = zonedParts(d)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

if (testMode) {
  await post(
    { Title: 'WebFit · prueba', Tags: 'white_check_mark', Priority: 'default' },
    'Si ves esto en el móvil, los avisos funcionan.',
  )
  console.log('Aviso de prueba enviado.')
  process.exit(0)
}

const planned = []
for (const r of config.reminders) {
  if (!r.enabled) continue
  for (const at of occurrences(r)) planned.push({ r, at })
}
planned.sort((a, b) => a.at - b.at)

console.log(
  `Ventana ${hhmm(windowStart)} ${todayBase.day}/${todayBase.month} → ${hhmm(windowEnd)} (${TZ}). ` +
    `${planned.length} avisos.`,
)

for (const { r, at } of planned) {
  const icon = ICON[r.kind] ?? ICON.other
  const title = `${icon} ${r.label}`
  const body = r.detail ? `${hhmm(at)} · ${r.detail}` : hhmm(at)
  console.log(`  ${hhmm(at)}  ${r.label}`)
  if (dryRun) continue
  await post(
    {
      Title: title,
      Tags: TAG[r.kind] ?? TAG.other,
      Priority: r.kind === 'supplement' ? 'high' : 'default',
      'X-At': String(Math.floor(at.getTime() / 1000)),
    },
    body,
  )
}

if (dryRun) console.log('(--dry-run: no se ha enviado nada)')
