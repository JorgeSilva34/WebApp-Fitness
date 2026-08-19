import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { addDays, formatShort, todayISO } from '../lib/date'
import { adjustmentFor, averageIn, dayTotals, weeklyReview } from '../lib/nutrition'
import { ALL_EXERCISES } from '../lib/plan'
import { fmt, sessionVolume, topSet } from '../lib/progression'
import { WeightChart } from '../components/WeightChart'
import { Button, Card, CardTitle, Note, Screen } from '../components/ui'

const nf = new Intl.NumberFormat('es-ES')
const kg = (n: number) => n.toFixed(1).replace('.', ',')

export default function Progress() {
  const { store, update } = useStore()
  const today = todayISO()
  const review = weeklyReview(store, today)
  const decided = adjustmentFor(store, review.weekKey)

  const pace = useMemo(() => {
    const recent = averageIn(store.weights, addDays(today, -6), today)
    const previous = averageIn(store.weights, addDays(today, -13), addDays(today, -7))
    if (recent.avg === null || previous.avg === null) return null
    return { delta: recent.avg - previous.avg, recent: recent.avg, previous: previous.avg }
  }, [store.weights, today])

  const last14 = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i)).map((d) => ({
        date: d,
        totals: dayTotals(store, d),
      })),
    [store, today],
  )

  const floorDays = last14.filter((d) => d.totals.status !== 'below').length

  const sessions = useMemo(() => [...store.sessions].sort((a, b) => b.date.localeCompare(a.date)), [store.sessions])

  const trackedIds = useMemo(
    () => ALL_EXERCISES.filter((e) => store.sessions.some((s) => s.entries[e.id]?.length)).map((e) => e.id),
    [store.sessions],
  )
  const [exId, setExId] = useState<string>('')
  const selected = exId || trackedIds[0] || ''

  const history = useMemo(() => {
    if (!selected) return []
    return [...store.sessions]
      .filter((s) => s.entries[selected]?.length)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ date: s.date, top: topSet(s.entries[selected]) }))
      .slice(-8)
      .reverse()
  }, [store.sessions, selected])

  return (
    <Screen title="Progreso" subtitle="Tendencias, no días sueltos.">
      <Card>
        <CardTitle>Peso corporal</CardTitle>
        <WeightChart weights={store.weights} />
        {pace && (
          <p className="mt-3 text-sm text-muted">
            Ritmo de los últimos 7 días frente a los 7 anteriores:{' '}
            <span className="text-text tabular-nums">
              {pace.delta >= 0 ? '+' : '−'}
              {kg(Math.abs(pace.delta))} kg
            </span>{' '}
            ({kg(pace.previous)} → {kg(pace.recent)} kg de media).
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Revisión semanal</CardTitle>
        {review.kind === 'insufficient' ? (
          <Note>
            Faltan datos para revisar la semana cerrada el {formatShort(review.weekKey)}: hay {review.recentCount}{' '}
            pesajes en esa semana y {review.previousCount} en la anterior. Hacen falta 4 en cada una.
          </Note>
        ) : decided ? (
          <Note>
            Semana del {formatShort(review.weekKey)} ya revisada:{' '}
            {decided.decision === 'accepted'
              ? `objetivo ajustado a ${nf.format(decided.proposedKcal)} kcal.`
              : `propuesta descartada, el objetivo sigue en ${nf.format(decided.previousKcal)} kcal.`}
          </Note>
        ) : (
          <div>
            <p className="text-sm text-muted">
              Media de la semana cerrada el {formatShort(review.weekKey)}: {kg(review.recentAvg)} kg · semana anterior:{' '}
              {kg(review.previousAvg)} kg (
              {review.deltaKg >= 0 ? '+' : '−'}
              {kg(Math.abs(review.deltaKg))} kg). {review.reason}
            </p>
            <p className="mt-2 text-base">
              {review.change === 0 ? (
                <>Propuesta: mantener el objetivo en {nf.format(review.currentKcal)} kcal.</>
              ) : (
                <>
                  Propuesta: {review.change > 0 ? 'subir' : 'bajar'} el objetivo de {nf.format(review.currentKcal)} a{' '}
                  <span className="text-target">{nf.format(review.proposedKcal)}</span> kcal.
                </>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() =>
                  update((s) => {
                    s.profile.kcalTarget = review.proposedKcal
                    s.adjustments.push({
                      weekKey: review.weekKey,
                      deltaKg: review.deltaKg,
                      proposedKcal: review.proposedKcal,
                      previousKcal: review.currentKcal,
                      decision: 'accepted',
                      decidedAt: Date.now(),
                    })
                    return s
                  })
                }
              >
                Aplicar
              </Button>
              <Button
                className="flex-1"
                onClick={() =>
                  update((s) => {
                    s.adjustments.push({
                      weekKey: review.weekKey,
                      deltaKg: review.deltaKg,
                      proposedKcal: review.proposedKcal,
                      previousKcal: review.currentKcal,
                      decision: 'dismissed',
                      decidedAt: Date.now(),
                    })
                    return s
                  })
                }
              >
                Dejarlo como está
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle hint="Cada barra es un día. Verde: suelo alcanzado. Azul: objetivo.">Ingesta · 14 días</CardTitle>
        <ul className="flex h-24 items-end gap-1" aria-label="Calorías de los últimos catorce días">
          {last14.map((d) => {
            const h = Math.max(4, Math.round(d.totals.targetPct * 100))
            const color =
              d.totals.status === 'target' ? 'bg-target' : d.totals.status === 'floor' ? 'bg-floor' : 'bg-muted/40'
            return (
              <li key={d.date} className="flex-1">
                <div
                  className={`w-full rounded-t ${color}`}
                  style={{ height: `${h}%` }}
                  title={`${formatShort(d.date)}: ${nf.format(d.totals.kcal)} kcal`}
                />
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-sm text-muted">
          {floorDays} de 14 días con el suelo alcanzado.
        </p>
      </Card>

      <Card>
        <CardTitle>Carga por ejercicio</CardTitle>
        {trackedIds.length === 0 ? (
          <Note>Aún no hay sesiones registradas.</Note>
        ) : (
          <>
            <select
              value={selected}
              onChange={(e) => setExId(e.target.value)}
              aria-label="Ejercicio"
              className="tap w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-base"
            >
              {trackedIds.map((id) => (
                <option key={id} value={id}>
                  {ALL_EXERCISES.find((e) => e.id === id)?.name ?? id}
                </option>
              ))}
            </select>
            <ul className="mt-3 flex flex-col gap-1">
              {history.map((h) => (
                <li key={h.date} className="flex justify-between border-b border-line/60 py-1 text-sm">
                  <span className="text-muted">{formatShort(h.date)}</span>
                  <span className="tabular-nums">
                    {h.top ? `${fmt(h.top.weight)} kg × ${h.top.reps}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Historial de sesiones</CardTitle>
        {sessions.length === 0 ? (
          <Note>Todavía no hay sesiones.</Note>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.slice(0, 12).map((s) => (
              <li key={s.date} className="flex items-baseline justify-between border-b border-line/60 pb-2 text-sm">
                <span>
                  <span className="font-medium">{formatShort(s.date)}</span>
                  <span className="ml-2 text-muted">Día {s.day}</span>
                </span>
                <span className="tabular-nums text-muted">{nf.format(sessionVolume(s))} kg de volumen</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Screen>
  )
}
