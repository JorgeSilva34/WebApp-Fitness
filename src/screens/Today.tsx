import { useMemo, useState } from 'react'
import type { Tab } from '../App'
import { useStore } from '../lib/store'
import { todayISO, formatLong } from '../lib/date'
import { dayIntake, dayTotals } from '../lib/nutrition'
import { suggestedDay } from '../lib/progression'
import { IntakeBar } from '../components/IntakeBar'
import { Button, Card, CardTitle, NumberField, Note, Screen } from '../components/ui'

const nf = new Intl.NumberFormat('es-ES')

export default function Today({ go }: { go: (t: Tab) => void }) {
  const { store, update, toggleMeal, setExtra, setWeight } = useStore()
  const date = todayISO()
  const day = dayIntake(store, date)
  const totals = dayTotals(store, date)
  const weightToday = store.weights.find((w) => w.date === date)
  const [weightDraft, setWeightDraft] = useState<number | ''>(weightToday?.kg ?? '')
  const [extrasOpen, setExtrasOpen] = useState(day.extraKcal > 0 || day.extraProtein > 0)

  const allLogged = store.meals.length > 0 && store.meals.every((m) => day.logged.includes(m.id))

  const sessionToday = useMemo(() => store.sessions.find((s) => s.date === date), [store.sessions, date])
  const nextDay = suggestedDay(store)

  return (
    <Screen title="Hoy" subtitle={formatLong(date)}>
      <Card>
        <IntakeBar
          totals={totals}
          floor={store.profile.kcalFloor}
          target={store.profile.kcalTarget}
          protein={totals.protein}
          proteinTarget={store.profile.proteinTarget}
        />
      </Card>

      <Card>
        <CardTitle hint="Un toque marca la toma. Las horas no importan: cuentan los eventos.">Tomas</CardTitle>
        <ul className="flex flex-col gap-2">
          {store.meals.map((meal) => {
            const done = day.logged.includes(meal.id)
            return (
              <li key={meal.id}>
                <button
                  type="button"
                  onClick={() => toggleMeal(date, meal.id)}
                  aria-pressed={done}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                    done ? 'border-floor/60 bg-floor/10' : 'border-line bg-surface-2'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${
                      done ? 'border-floor bg-floor/30 text-floor' : 'border-line text-muted'
                    }`}
                  >
                    {done ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{meal.label}</span>
                    <span className="block truncate text-sm text-muted">{meal.anchor}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm tabular-nums text-muted">
                    {nf.format(meal.kcal)} kcal
                    <br />
                    {meal.protein} g
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1"
            onClick={() =>
              update((s) => {
                const current = s.intake[date] ?? { logged: [], extraKcal: 0, extraProtein: 0 }
                s.intake[date] = { ...current, logged: allLogged ? [] : s.meals.map((m) => m.id) }
                return s
              })
            }
          >
            {allLogged ? 'Desmarcar todas' : 'Marcar todas'}
          </Button>
          {!extrasOpen && (
            <Button variant="ghost" className="flex-1" onClick={() => setExtrasOpen(true)}>
              + Algo suelto
            </Button>
          )}
        </div>

        {extrasOpen && (
          <div className="mt-4 border-t border-line pt-4">
            <CardTitle>Extras del día</CardTitle>
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-sm text-muted">kcal</span>
                <NumberField
                  value={day.extraKcal || ''}
                  onValue={(v) => setExtra(date, v === '' ? 0 : v, day.extraProtein)}
                  placeholder="0"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-sm text-muted">proteína (g)</span>
                <NumberField
                  value={day.extraProtein || ''}
                  onValue={(v) => setExtra(date, day.extraKcal, v === '' ? 0 : v)}
                  placeholder="0"
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[100, 250, 500].map((n) => (
                <Button key={n} onClick={() => setExtra(date, day.extraKcal + n, day.extraProtein)}>
                  +{n} kcal
                </Button>
              ))}
              <Button variant="ghost" onClick={() => setExtra(date, 0, 0)}>
                Poner a cero
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle hint="Al levantarte, antes de comer o beber. Si un día no te pesas, no pasa nada.">
          Peso de hoy
        </CardTitle>
        <div className="flex gap-2">
          <NumberField
            value={weightDraft}
            onValue={setWeightDraft}
            decimals
            suffix="kg"
            placeholder="—"
            aria-label="Peso corporal de hoy en kilogramos"
          />
          <Button
            variant="primary"
            className="shrink-0"
            onClick={() => setWeight(date, weightDraft === '' ? null : weightDraft)}
          >
            Guardar
          </Button>
        </div>
        {weightToday && (
          <Note>
            Registrado: {weightToday.kg.toFixed(1).replace('.', ',')} kg.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                setWeight(date, null)
                setWeightDraft('')
              }}
            >
              Borrar
            </button>
          </Note>
        )}
      </Card>

      <Card>
        <CardTitle>Entrenamiento</CardTitle>
        {sessionToday ? (
          <Note>Sesión del día {sessionToday.day} registrada hoy.</Note>
        ) : (
          <Note>Toca cuando entrenes. Hoy corresponde el día {nextDay} según la alternancia A–B.</Note>
        )}
        <Button variant="primary" className="mt-3 w-full" onClick={() => go('sesion')}>
          {sessionToday ? 'Abrir la sesión de hoy' : `Empezar sesión — día ${nextDay}`}
        </Button>
      </Card>
    </Screen>
  )
}
