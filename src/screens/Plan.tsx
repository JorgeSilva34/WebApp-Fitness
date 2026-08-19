import { DAY_A, DAY_B, THORACIC } from '../lib/plan'
import type { Exercise } from '../lib/types'
import { Card, CardTitle, Screen } from '../components/ui'

function prescription(ex: Exercise): string {
  if (ex.note && ex.kind !== 'reps') return ex.note
  if (ex.kind === 'amrap') return `${ex.sets} series al máximo controlado`
  if (ex.repMin === ex.repMax) return `${ex.sets} × ${ex.repMin}`
  return `${ex.sets} × ${ex.repMin}-${ex.repMax}`
}

function DayTable({ title, list }: { title: string; list: Exercise[] }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <ul className="flex flex-col">
        {list.map((ex) => (
          <li key={ex.id} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2 last:border-0">
            <span>{ex.name}</span>
            <span className="shrink-0 text-sm tabular-nums text-muted">{prescription(ex)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function Plan() {
  return (
    <Screen title="Plan" subtitle="Referencia consultable. Nada que rellenar aquí.">
      <Card>
        <CardTitle>Estructura</CardTitle>
        <p className="text-sm leading-relaxed text-muted">
          Full body 3 días por semana, alternando A–B–A una semana y B–A–B la siguiente. Frecuencia alta con poco volumen
          por sesión y coste calórico bajo: encaja con una capacidad de recuperación limitada por la ingesta.
        </p>
      </Card>

      <DayTable title="Día A" list={DAY_A} />
      <DayTable title="Día B" list={DAY_B} />

      <section className="rounded-2xl border border-accent/40 bg-accent/5 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          Bloque torácico — fijo al final de ambos días
        </h2>
        <ul className="mt-3 flex flex-col">
          {THORACIC.map((ex) => (
            <li key={ex.id} className="border-b border-line/60 py-2 last:border-0">
              <div className="flex items-baseline justify-between gap-3">
                <span>{ex.name}</span>
                <span className="shrink-0 text-sm text-muted">
                  {ex.kind === 'reps' ? `${ex.sets} × ${ex.repMin}-${ex.repMax}` : ''}
                </span>
              </div>
              {ex.note && <p className="mt-0.5 text-sm text-muted">{ex.note}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Ningún ejercicio modifica el índice de Haller ni la estructura ósea del tórax. Este bloque busca mecánica
          respiratoria, postura y desarrollo de la musculatura circundante.
        </p>
      </section>

      <Card>
        <CardTitle>Progresión (doble progresión)</CardTitle>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted">
          <li>Empieza en el extremo bajo del rango, dejando 2-3 repeticiones en recámara.</li>
          <li>Cada sesión, intenta sumar una repetición en alguna serie con el mismo peso.</li>
          <li>
            Cuando todas las series lleguen al extremo alto, sube la carga: +2,5 kg en tren superior, +5 kg en tren
            inferior, y vuelve al extremo bajo del rango.
          </li>
          <li>Descansos: 3 min en los básicos, 90 s en el resto.</li>
          <li>La pantalla de Sesión ya calcula esto: propone peso y repeticiones, y tú aceptas o editas.</li>
          <li>El plan no contempla llegar al fallo ni series de una repetición máxima.</li>
        </ul>
      </Card>

      <Card>
        <CardTitle>Reglas de alimentación</CardTitle>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            Dos marcas, no una: el <span className="text-floor">suelo</span> es el mínimo innegociable y alcanzarlo ya
            cuenta como día cumplido; el <span className="text-target">objetivo</span> es el estado destacado.
          </li>
          <li>Las tomas se anclan a eventos —al levantarme, al volver de entrenar—, no a horas del reloj.</li>
          <li>Registrar es un toque por toma. No hay pesajes de alimentos ni búsquedas.</li>
          <li>Los líquidos calóricos cuestan menos esfuerzo que los sólidos: los batidos existen por eso.</li>
          <li>Cada domingo se compara la media de peso de 7 días con la de los 7 anteriores y se propone un ajuste.</li>
          <li>Un día por debajo del suelo es un dato, no un fallo. No hay rachas que reiniciar.</li>
        </ul>
      </Card>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Salud · leer una vez y recordar</h2>
        <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            El índice de Haller medido hace años estaba en el límite quirúrgico y no se ha reevaluado desde entonces.
            Pide una valoración actual: es información que conviene tener antes de seguir subiendo cargas, no un motivo
            de alarma.
          </p>
          <p>
            Detén el entrenamiento y consulta si aparece dolor torácico, palpitaciones, mareo o falta de aire
            desproporcionada al esfuerzo.
          </p>
          <p>
            Ningún ejercicio modifica el índice de Haller ni la estructura ósea del tórax. El bloque torácico trabaja
            mecánica respiratoria, postura y musculatura circundante.
          </p>
          <p className="text-muted">
            Esta aplicación registra y calcula. No diagnostica ni sustituye la valoración de un médico, un
            dietista-nutricionista o un fisioterapeuta.
          </p>
        </div>
      </section>
    </Screen>
  )
}
