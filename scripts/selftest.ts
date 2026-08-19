// Comprobación de la lógica pura (sin interfaz).
// Ejecutar: npm run test
import { emptyStore } from '../src/lib/seed'
import { normalize, exportJSON, parseImport } from '../src/lib/storage'
import { dayTotals, weeklyReview } from '../src/lib/nutrition'
import { proposeFor, suggestedDay } from '../src/lib/progression'
import { DAY_A } from '../src/lib/plan'
import { addDays } from '../src/lib/date'
import { endpointFor } from '../src/lib/sync'
import type { Store } from '../src/lib/types'

let failures = 0
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ok  ${name}`)
  } else {
    failures++
    console.log(`FAIL  ${name}`, extra ?? '')
  }
}

const squat = DAY_A[0] // 3 × 5-8, +5 kg
const press = DAY_A[1] // 3 × 6-10, +2,5 kg

// --- Progresión ---
{
  const s = emptyStore()
  const p = proposeFor(s, squat)
  check('primera vez propone el extremo bajo del rango', p.kind === 'first' && p.sets.every((x) => x.reps === 5))
}
{
  const s = emptyStore()
  s.sessions.push({
    date: '2026-08-10',
    day: 'A',
    entries: { squat: [{ weight: 40, reps: 6 }, { weight: 40, reps: 6 }, { weight: 40, reps: 6 }] },
  })
  const p = proposeFor(s, squat)
  check('suma una repetición en la primera serie por debajo del tope', p.kind === 'add-rep', p.sets)
  check('la propuesta mantiene el peso', p.sets.every((x) => x.weight === 40))
  check('sólo cambia una serie', p.sets.map((x) => x.reps).join(',') === '7,6,6', p.sets)
}
{
  const s = emptyStore()
  s.sessions.push({
    date: '2026-08-10',
    day: 'A',
    entries: { squat: [{ weight: 40, reps: 8 }, { weight: 40, reps: 8 }, { weight: 40, reps: 8 }] },
  })
  const p = proposeFor(s, squat)
  check('sube +5 kg al llegar al tope en todas las series', p.kind === 'add-weight' && p.sets.every((x) => x.weight === 45))
  check('al subir peso vuelve al extremo bajo', p.sets.every((x) => x.reps === 5))
}
{
  const s = emptyStore()
  s.sessions.push({
    date: '2026-08-10',
    day: 'A',
    entries: { 'inc-db-press': [{ weight: 14, reps: 10 }, { weight: 14, reps: 10 }, { weight: 14, reps: 10 }] },
  })
  const p = proposeFor(s, press)
  check('tren superior sube +2,5 kg', p.sets.every((x) => x.weight === 16.5), p.sets)
}
{
  const s = emptyStore()
  s.sessions.push({ date: '2026-08-10', day: 'A', entries: { squat: [{ weight: 40, reps: 6 }] } })
  check('alterna el día A/B', suggestedDay(s) === 'B')
}
{
  const s = emptyStore()
  s.sessions.push({
    date: '2026-08-10',
    day: 'A',
    entries: { squat: [{ weight: 40, reps: 6 }, { weight: 40, reps: 6 }, { weight: 40, reps: 6 }] },
  })
  const p = proposeFor(s, squat, '2026-08-05')
  check('ignora sesiones posteriores a la fecha consultada', p.kind === 'first')
}

// --- Ingesta ---
{
  const s = emptyStore()
  s.intake['2026-08-19'] = { logged: ['m1', 'm2'], extraKcal: 0, extraProtein: 0 } // 1700 kcal
  const t = dayTotals(s, '2026-08-19')
  check('por debajo del suelo, estado neutro', t.kcal === 1700 && t.status === 'below')
  s.intake['2026-08-19'].logged.push('m3') // 2200
  check('suelo alcanzado cuenta como día cumplido', dayTotals(s, '2026-08-19').status === 'floor')
  s.intake['2026-08-19'].extraKcal = 1000 // 3200
  check('objetivo alcanzado destaca', dayTotals(s, '2026-08-19').status === 'target')
}

// --- Revisión semanal ---
function withWeights(deltaPerWeek: number, count: number): Store {
  const s = emptyStore()
  const sunday = '2026-08-16' // domingo
  for (let i = 0; i < count; i++) {
    s.weights.push({ date: addDays(sunday, -i), kg: 60 + deltaPerWeek })
    s.weights.push({ date: addDays(sunday, -7 - i), kg: 60 })
  }
  s.weights.sort((a, b) => a.date.localeCompare(b.date))
  return s
}
{
  const r = weeklyReview(withWeights(0.05, 4), '2026-08-19')
  check('subida lenta propone +250 kcal', r.kind === 'proposal' && r.change === 250, r)
}
{
  const r = weeklyReview(withWeights(0.4, 4), '2026-08-19')
  check('ritmo correcto no cambia nada', r.kind === 'proposal' && r.change === 0, r)
}
{
  const r = weeklyReview(withWeights(1.0, 4), '2026-08-19')
  check('subida rápida propone −150 kcal', r.kind === 'proposal' && r.change === -150, r)
}
{
  const r = weeklyReview(withWeights(0.4, 3), '2026-08-19')
  check('con menos de 4 pesajes por ventana avisa en vez de ajustar', r.kind === 'insufficient', r)
}

// --- Persistencia ---
{
  const s = emptyStore()
  s.weights.push({ date: '2026-08-19', kg: 59.4 })
  s.intake['2026-08-19'] = { logged: ['m1'], extraKcal: 120, extraProtein: 8 }
  s.sessions.push({ date: '2026-08-19', day: 'A', entries: { squat: [{ weight: 40, reps: 6 }] }, notes: 'ok' })
  const round = parseImport(exportJSON(s))
  check('exportar e importar reproduce el estado exacto', JSON.stringify(round) === JSON.stringify(s))
  check('un JSON con basura no rompe la carga', normalize({ version: 1, weights: 'x', sessions: [{}] }).weights.length === 0)
  check('un JSON vacío devuelve el estado semilla', normalize(null).meals.length === 5)
}

// --- Dirección de la API ---
{
  const expected = 'https://midominio.com/api/state.php'
  check('acepta el dominio pelado', endpointFor('midominio.com') === expected)
  check('acepta la URL con https', endpointFor('https://midominio.com/') === expected)
  check('acepta la carpeta /api', endpointFor('https://midominio.com/api') === expected)
  check('respeta una ruta completa a un .php', endpointFor('https://x.com/otro/estado.php') === 'https://x.com/otro/estado.php')
  check('no toca http en local', endpointFor('http://localhost:8787/api') === 'http://localhost:8787/api/state.php')
}

console.log(failures === 0 ? '\nTodo correcto.' : `\n${failures} comprobaciones fallidas.`)
process.exit(failures === 0 ? 0 : 1)
