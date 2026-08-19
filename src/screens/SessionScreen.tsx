import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { todayISO, formatLong, formatShort } from '../lib/date'
import { exercisesFor, THORACIC } from '../lib/plan'
import { fmt, proposeFor, suggestedDay } from '../lib/progression'
import type { Proposal } from '../lib/progression'
import type { Exercise, SetEntry } from '../lib/types'
import { Button, Card, CardTitle, NumberField, Note, Screen } from '../components/ui'

type Draft = Record<string, SetEntry[]>

export default function SessionScreen() {
  const { store, update } = useStore()
  const date = todayISO()
  const existing = store.sessions.find((s) => s.date === date)
  const [day, setDay] = useState<'A' | 'B'>(existing?.day ?? suggestedDay(store))
  const [draft, setDraft] = useState<Draft>({})
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saved, setSaved] = useState(false)

  const exercises = useMemo(() => [...exercisesFor(day), ...THORACIC], [day])

  // Al abrir la sesión (o al cambiar de día) se precargan las propuestas calculadas.
  useEffect(() => {
    const next: Draft = {}
    for (const ex of exercises) {
      const fromSession = existing?.entries[ex.id]
      if (fromSession?.length) {
        next[ex.id] = fromSession.map((s) => ({ ...s }))
        continue
      }
      const proposal = proposeFor(store, ex, date)
      next[ex.id] = ex.kind === 'time' ? [] : proposal.sets.map((s) => ({ ...s }))
    }
    setDraft(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  const setValue = (exId: string, index: number, key: keyof SetEntry, value: number) =>
    setDraft((d) => {
      const sets = (d[exId] ?? []).map((s, i) => (i === index ? { ...s, [key]: value } : s))
      return { ...d, [exId]: sets }
    })

  const toggleTime = (exId: string) =>
    setDraft((d) => ({ ...d, [exId]: d[exId]?.length ? [] : [{ weight: 0, reps: 1 }] }))

  const save = () => {
    const entries: Draft = {}
    for (const ex of exercises) {
      const sets = draft[ex.id] ?? []
      if (ex.kind === 'time') {
        if (sets.length) entries[ex.id] = [{ weight: 0, reps: 1 }]
        continue
      }
      const done = sets.filter((s) => s.reps > 0)
      if (done.length) entries[ex.id] = done
    }
    update((s) => {
      s.sessions = s.sessions.filter((x) => x.date !== date)
      s.sessions.push({ date, day, entries, notes: notes.trim() || undefined, createdAt: Date.now() })
      s.sessions.sort((a, b) => a.date.localeCompare(b.date))
      return s
    })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Screen title="Sesión" subtitle={formatLong(date)}>
      <Card>
        <CardTitle>Día</CardTitle>
        <div className="flex gap-2">
          {(['A', 'B'] as const).map((d) => (
            <Button key={d} variant={day === d ? 'primary' : 'default'} className="flex-1" onClick={() => setDay(d)}>
              Día {d}
            </Button>
          ))}
        </div>
        <Note>
          Alternancia A–B–A / B–A–B. Descansos: 3 min en los básicos, 90 s en el resto. Exhala en el esfuerzo y evita
          apneas prolongadas bajo carga. El plan no contempla llegar al fallo ni series de una repetición máxima.
        </Note>
      </Card>

      {exercisesFor(day).map((ex) => (
        <ExerciseCard
          key={ex.id}
          ex={ex}
          sets={draft[ex.id] ?? []}
          proposal={proposeFor(store, ex, date)}
          onChange={setValue}
        />
      ))}

      <section className="rounded-2xl border border-accent/40 bg-accent/5 p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">Bloque torácico</h2>
        <p className="mt-1 text-sm text-muted">
          Parte fija de la sesión, no opcional. Trabaja mecánica respiratoria, postura y musculatura circundante.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {THORACIC.map((ex) =>
            ex.kind === 'time' ? (
              <button
                key={ex.id}
                type="button"
                aria-pressed={Boolean(draft[ex.id]?.length)}
                onClick={() => toggleTime(ex.id)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left ${
                  draft[ex.id]?.length ? 'border-floor/60 bg-floor/10' : 'border-line bg-surface-2'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${
                    draft[ex.id]?.length ? 'border-floor bg-floor/30 text-floor' : 'border-line text-muted'
                  }`}
                >
                  {draft[ex.id]?.length ? '✓' : ''}
                </span>
                <span>
                  <span className="block font-medium">{ex.name}</span>
                  <span className="block text-sm text-muted">{ex.note}</span>
                </span>
              </button>
            ) : (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                sets={draft[ex.id] ?? []}
                proposal={proposeFor(store, ex, date)}
                onChange={setValue}
              />
            ),
          )}
        </div>
      </section>

      <Card>
        <CardTitle>Notas</CardTitle>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Sensaciones, molestias, material…"
          className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-base"
        />
      </Card>

      <Button variant="primary" className="w-full" onClick={save}>
        {existing ? 'Actualizar sesión' : 'Cerrar sesión'}
      </Button>
      {saved && <Note tone="accent">Sesión guardada.</Note>}
    </Screen>
  )
}

function ExerciseCard({
  ex,
  sets,
  proposal,
  onChange,
}: {
  ex: Exercise
  sets: SetEntry[]
  proposal: Proposal
  onChange: (exId: string, index: number, key: keyof SetEntry, value: number) => void
}) {
  const range = ex.kind === 'amrap' ? 'máximo controlado' : `${ex.repMin}-${ex.repMax}`
  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{ex.name}</h3>
        <span className="shrink-0 text-sm text-muted">
          {ex.sets} × {range}
        </span>
      </div>

      <p className="text-sm text-target">{proposal.reason}</p>
      {proposal.lastSets && proposal.lastDate && (
        <p className="mt-1 text-sm text-muted">
          Última vez ({formatShort(proposal.lastDate)}):{' '}
          {proposal.lastSets.map((s) => `${s.reps}×${fmt(s.weight)} kg`).join(' · ')}
        </p>
      )}
      {ex.note && <p className="mt-1 text-sm text-accent">{ex.note}</p>}

      <ul className="mt-3 flex flex-col gap-2">
        {sets.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-sm text-muted">S{i + 1}</span>
            <label className="flex-1">
              <span className="sr-only">{`Peso de la serie ${i + 1} de ${ex.name}`}</span>
              <NumberField
                value={s.weight}
                onValue={(v) => onChange(ex.id, i, 'weight', v === '' ? 0 : v)}
                decimals
                suffix="kg"
              />
            </label>
            <label className="flex-1">
              <span className="sr-only">{`Repeticiones de la serie ${i + 1} de ${ex.name}`}</span>
              <NumberField value={s.reps} onValue={(v) => onChange(ex.id, i, 'reps', v === '' ? 0 : v)} suffix="reps" />
            </label>
          </li>
        ))}
      </ul>
    </Card>
  )
}
