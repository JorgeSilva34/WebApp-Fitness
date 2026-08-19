import { useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { exportJSON, parseImport } from '../lib/storage'
import { todayISO } from '../lib/date'
import type { Meal, Reminder } from '../lib/types'
import { Button, Card, CardTitle, NumberField, Note, Screen, Toggle } from '../components/ui'

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

function SyncCard() {
  const { sync } = useStore()
  const [url, setUrl] = useState(sync.config?.url ?? '')
  const [token, setToken] = useState(sync.config?.token ?? '')

  const last = sync.lastSyncAt
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(sync.lastSyncAt)
    : null

  const line: Record<typeof sync.status, string> = {
    off: 'Sin servidor: los datos sólo están en este dispositivo.',
    idle: last ? `Al día. Última sincronización: ${last}.` : 'Al día.',
    syncing: 'Sincronizando…',
    pending: 'Cambios pendientes de subir.',
    offline: 'Sin conexión. Los cambios se guardan aquí y se suben solos al volver.',
    conflict: 'Otro dispositivo guardó cambios antes que este.',
    error: 'El servidor no responde como se espera.',
  }

  return (
    <Card>
      <CardTitle hint="Guarda los datos en la base de datos de Hostinger para verlos desde cualquier dispositivo. La copia local se mantiene, así que la app sigue funcionando sin cobertura.">
        Sincronización
      </CardTitle>

      <p
        className={`text-sm ${
          sync.status === 'conflict' || sync.status === 'error'
            ? 'text-accent'
            : sync.status === 'idle'
              ? 'text-floor'
              : 'text-muted'
        }`}
      >
        {line[sync.status]}
      </p>
      {sync.error && <p className="mt-1 text-sm text-muted">{sync.error}</p>}

      {sync.status === 'conflict' && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 p-3">
          <p className="text-sm">
            Elige con qué versión te quedas. Antes de decidir puedes exportar una copia de lo que hay en este
            dispositivo.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={sync.keepLocal}>
              Mandar lo de aquí
            </Button>
            <Button className="flex-1" onClick={sync.takeServer}>
              Traer lo del servidor
            </Button>
          </div>
        </div>
      )}

      {sync.config ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-muted break-all">
            {sync.config.url} · revisión {sync.revision}
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={sync.syncNow}>
              Sincronizar ahora
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                sync.configure(null)
                setToken('')
              }}
            >
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <label>
            <span className="mb-1 block text-sm text-muted">Dirección del servidor</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              autoComplete="off"
              placeholder="https://midominio.com"
              aria-label="Dirección del servidor"
              className="tap w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-base"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-muted">Token</span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              autoComplete="off"
              spellCheck={false}
              aria-label="Token de acceso a la API"
              className="tap w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-base"
            />
          </label>
          <Button
            variant="primary"
            disabled={!url.trim() || !token.trim()}
            onClick={() => sync.configure({ url: url.trim(), token: token.trim() })}
          >
            Conectar
          </Button>
          <Note>
            El token se guarda en este dispositivo y viaja en cada petición: usa siempre HTTPS. Si la base de datos está
            vacía, se sube lo que haya aquí; si ya tiene datos, se traen a este dispositivo.
          </Note>
        </div>
      )}
    </Card>
  )
}

export default function Settings() {
  const { store, update, replace, reset } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const flash = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg(null), 4000)
  }

  const download = () => {
    const blob = new Blob([exportJSON(store)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `webfit-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('Copia exportada.')
  }

  const importFile = async (file: File) => {
    try {
      replace(parseImport(await file.text()))
      flash('Datos importados. El estado anterior se ha sustituido por completo.')
    } catch {
      flash('No se pudo leer el archivo: no es un JSON válido de esta aplicación.')
    }
  }

  const setMeal = (id: string, patch: Partial<Meal>) =>
    update((s) => {
      s.meals = s.meals.map((m) => (m.id === id ? { ...m, ...patch } : m))
      return s
    })

  const setReminder = (id: string, patch: Partial<Reminder>) =>
    update((s) => {
      s.reminders = s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r))
      return s
    })

  return (
    <Screen title="Ajustes">
      <Card>
        <CardTitle hint="El suelo es el mínimo innegociable; el objetivo, la cifra a la que apuntas.">
          Objetivos
        </CardTitle>
        <div className="flex flex-col gap-3">
          <label>
            <span className="mb-1 block text-sm text-muted">Suelo calórico (kcal)</span>
            <NumberField
              value={store.profile.kcalFloor}
              onValue={(v) =>
                update((s) => {
                  s.profile.kcalFloor = v === '' ? 0 : v
                  return s
                })
              }
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-muted">Objetivo calórico (kcal)</span>
            <NumberField
              value={store.profile.kcalTarget}
              onValue={(v) =>
                update((s) => {
                  s.profile.kcalTarget = v === '' ? 0 : v
                  return s
                })
              }
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-muted">Proteína (g)</span>
            <NumberField
              value={store.profile.proteinTarget}
              onValue={(v) =>
                update((s) => {
                  s.profile.proteinTarget = v === '' ? 0 : v
                  return s
                })
              }
            />
          </label>
          <label>
            <span className="mb-1 block text-sm text-muted">Altura (cm)</span>
            <NumberField
              value={store.profile.heightCm}
              onValue={(v) =>
                update((s) => {
                  s.profile.heightCm = v === '' ? 0 : v
                  return s
                })
              }
            />
          </label>
        </div>
      </Card>

      <Card>
        <CardTitle hint="El texto del ancla es lo que verás en la pantalla de Hoy.">Tomas</CardTitle>
        <ul className="flex flex-col gap-4">
          {store.meals.map((meal) => (
            <li key={meal.id} className="border-b border-line/60 pb-4 last:border-0 last:pb-0">
              <input
                value={meal.label}
                onChange={(e) => setMeal(meal.id, { label: e.target.value })}
                aria-label="Nombre de la toma"
                className="tap w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-base"
              />
              <input
                value={meal.anchor}
                onChange={(e) => setMeal(meal.id, { anchor: e.target.value })}
                aria-label="Momento de la toma"
                placeholder="Al levantarme, al volver de entrenar…"
                className="tap mt-2 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-base"
              />
              <div className="mt-2 flex gap-2">
                <label className="flex-1">
                  <span className="mb-1 block text-sm text-muted">kcal</span>
                  <NumberField value={meal.kcal} onValue={(v) => setMeal(meal.id, { kcal: v === '' ? 0 : v })} />
                </label>
                <label className="flex-1">
                  <span className="mb-1 block text-sm text-muted">proteína (g)</span>
                  <NumberField value={meal.protein} onValue={(v) => setMeal(meal.id, { protein: v === '' ? 0 : v })} />
                </label>
              </div>
              <Button
                variant="ghost"
                className="mt-2"
                onClick={() =>
                  update((s) => {
                    s.meals = s.meals.filter((m) => m.id !== meal.id)
                    return s
                  })
                }
              >
                Eliminar toma
              </Button>
            </li>
          ))}
        </ul>
        <Button
          className="mt-3 w-full"
          onClick={() =>
            update((s) => {
              s.meals.push({
                id: `m${Date.now().toString(36)}`,
                label: 'Nueva toma',
                anchor: '',
                kcal: 400,
                protein: 20,
              })
              return s
            })
          }
        >
          + Añadir toma
        </Button>
      </Card>

      <Card>
        <CardTitle hint="Horas orientativas para los avisos al móvil. La app guarda la configuración; el envío lo hace la automatización externa (carpeta notify del repositorio).">
          Recordatorios
        </CardTitle>
        <ul className="flex flex-col gap-3">
          {store.reminders.map((r) => (
            <li key={r.id} className="border-b border-line/60 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <input
                  value={r.label}
                  onChange={(e) => setReminder(r.id, { label: e.target.value })}
                  aria-label="Nombre del recordatorio"
                  className="tap min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-base"
                />
                <input
                  type="time"
                  value={r.time}
                  onChange={(e) => setReminder(r.id, { time: e.target.value })}
                  aria-label="Hora del recordatorio"
                  className="tap shrink-0 rounded-xl border border-line bg-surface-2 px-2 py-2 text-base tabular-nums"
                />
                <Toggle
                  checked={r.enabled}
                  onChange={(v) => setReminder(r.id, { enabled: v })}
                  label={`Activar ${r.label}`}
                />
              </div>
              <input
                value={r.detail ?? ''}
                onChange={(e) => setReminder(r.id, { detail: e.target.value })}
                aria-label="Texto secundario del aviso"
                placeholder="Texto que acompaña al aviso (opcional)"
                className="tap mt-2 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-base"
              />
              <div className="mt-2 flex gap-1">
                {DAY_LABELS.map((d, i) => {
                  const on = r.days.includes(i)
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={on}
                      aria-label={`Día ${d}`}
                      onClick={() =>
                        setReminder(r.id, {
                          days: on ? r.days.filter((x) => x !== i) : [...r.days, i].sort(),
                        })
                      }
                      className={`h-9 flex-1 rounded-lg border text-sm ${
                        on ? 'border-floor/60 bg-floor/15 text-floor' : 'border-line bg-surface-2 text-muted'
                      }`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              update((s) => {
                s.reminders.push({
                  id: `r${Date.now().toString(36)}`,
                  label: 'Nuevo recordatorio',
                  time: '12:00',
                  days: [0, 1, 2, 3, 4, 5, 6],
                  enabled: true,
                  kind: 'other',
                })
                return s
              })
            }
          >
            + Añadir recordatorio
          </Button>
          <Button
            onClick={async () => {
              const json = JSON.stringify({ timezone: 'Atlantic/Canary', reminders: store.reminders }, null, 2)
              try {
                await navigator.clipboard.writeText(json)
                flash('Configuración copiada. Pégala en notify/reminders.json del repositorio.')
              } catch {
                flash('No se pudo copiar. Usa Exportar datos y toma el bloque "reminders".')
              }
            }}
          >
            Copiar para la automatización
          </Button>
        </div>
      </Card>

      <SyncCard />

      <Card>
        <CardTitle hint="La copia local vive en este navegador. Exporta de vez en cuando aunque uses el servidor.">
          Datos
        </CardTitle>
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={download}>
            Exportar copia (JSON)
          </Button>
          <Button onClick={() => fileRef.current?.click()}>Importar copia (JSON)</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
          <p className="text-sm text-muted">
            {store.weights.length} pesajes · {store.sessions.length} sesiones · {Object.keys(store.intake).length} días
            con ingesta registrada.
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle>Borrar todo</CardTitle>
        {confirmWipe ? (
          <div className="flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                reset()
                setConfirmWipe(false)
                flash('Datos borrados.')
              }}
            >
              Sí, borrar
            </Button>
            <Button className="flex-1" onClick={() => setConfirmWipe(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setConfirmWipe(true)}>
            Borrar todos los datos
          </Button>
        )}
        <Note>Exporta antes: esta acción no se puede deshacer.</Note>
      </Card>

      <Card>
        <CardTitle>Recordatorio de salud</CardTitle>
        <Note>
          El índice de Haller previo estaba en el límite quirúrgico y sigue sin reevaluar. Pide una valoración actual.
          Detén el entrenamiento y consulta ante dolor torácico, palpitaciones, mareo o falta de aire desproporcionada
          al esfuerzo. Esta aplicación registra y calcula; no diagnostica ni sustituye a un médico, un
          dietista-nutricionista o un fisioterapeuta.
        </Note>
      </Card>

      {msg && (
        <p role="status" className="rounded-xl border border-target/50 bg-target/10 p-3 text-sm text-target">
          {msg}
        </p>
      )}
    </Screen>
  )
}
