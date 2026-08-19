import { useState } from 'react'
import { useStore } from './lib/store'
import Today from './screens/Today'
import SessionScreen from './screens/SessionScreen'
import Progress from './screens/Progress'
import Plan from './screens/Plan'
import Settings from './screens/Settings'

export type Tab = 'hoy' | 'sesion' | 'progreso' | 'plan' | 'ajustes'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'hoy', label: 'Hoy', icon: '◍' },
  { id: 'sesion', label: 'Sesión', icon: '▤' },
  { id: 'progreso', label: 'Progreso', icon: '◔' },
  { id: 'plan', label: 'Plan', icon: '☰' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙' },
]

const SYNC_LABEL: Record<string, string> = {
  syncing: 'sincronizando…',
  pending: 'pendiente de subir',
  offline: 'sin conexión',
  conflict: 'conflicto de versiones',
  error: 'error de servidor',
}

/** Sólo aparece cuando hay algo que contar: en reposo no distrae. */
function SyncBadge({ go }: { go: (t: Tab) => void }) {
  const { sync } = useStore()
  const label = SYNC_LABEL[sync.status]
  if (!label) return null
  const alert = sync.status === 'conflict' || sync.status === 'error'
  return (
    <button
      type="button"
      onClick={() => go('ajustes')}
      className={`fixed right-3 top-3 z-30 rounded-full border px-3 py-1 text-xs ${
        alert ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line bg-surface/90 text-muted'
      }`}
    >
      {label}
    </button>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('hoy')

  return (
    <div className="min-h-dvh">
      <SyncBadge go={setTab} />
      <main>
        {tab === 'hoy' && <Today go={setTab} />}
        {tab === 'sesion' && <SessionScreen />}
        {tab === 'progreso' && <Progress />}
        {tab === 'plan' && <Plan />}
        {tab === 'ajustes' && <Settings />}
      </main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-xs ${
                  tab === t.id ? 'text-target' : 'text-muted'
                }`}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {t.icon}
                </span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
