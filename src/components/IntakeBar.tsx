import type { DayTotals } from '../lib/nutrition'

const nf = new Intl.NumberFormat('es-ES')

/** Doble umbral: suelo (mínimo innegociable) y objetivo.
 *  Por debajo del suelo el estado es neutro, nunca negativo. */
export function IntakeBar({
  totals,
  floor,
  target,
  protein,
  proteinTarget,
}: {
  totals: DayTotals
  floor: number
  target: number
  protein: number
  proteinTarget: number
}) {
  const floorPos = target > 0 ? Math.min(100, (floor / target) * 100) : 0
  const fill = Math.min(100, target > 0 ? (totals.kcal / target) * 100 : 0)
  const fillColor =
    totals.status === 'target' ? 'bg-target' : totals.status === 'floor' ? 'bg-floor' : 'bg-muted/50'

  const toFloor = Math.max(0, floor - totals.kcal)
  const toTarget = Math.max(0, target - totals.kcal)

  const label =
    totals.status === 'target'
      ? 'Objetivo alcanzado'
      : totals.status === 'floor'
        ? 'Día cumplido · suelo alcanzado'
        : `${nf.format(toFloor)} kcal para el suelo`

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-semibold tabular-nums">{nf.format(totals.kcal)}</span>
        <span className="text-sm text-muted tabular-nums">
          suelo {nf.format(floor)} · objetivo {nf.format(target)}
        </span>
      </div>

      <div
        className="relative mt-3 h-4 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={totals.kcal}
        aria-label="Calorías del día"
      >
        <div className={`h-full rounded-full transition-[width] ${fillColor}`} style={{ width: `${fill}%` }} />
        <div
          className="absolute inset-y-0 w-0.5 bg-text/70"
          style={{ left: `${floorPos}%` }}
          aria-hidden="true"
          title="Suelo"
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-sm">
        <span
          className={
            totals.status === 'target' ? 'text-target' : totals.status === 'floor' ? 'text-floor' : 'text-muted'
          }
        >
          {label}
        </span>
        {totals.status === 'floor' && (
          <span className="text-muted tabular-nums">{nf.format(toTarget)} kcal al objetivo</span>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted">Proteína</span>
          <span className="tabular-nums text-muted">
            {Math.round(protein)} / {proteinTarget} g
          </span>
        </div>
        <div
          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={proteinTarget}
          aria-valuenow={Math.round(protein)}
          aria-label="Proteína del día"
        >
          <div
            className={`h-full rounded-full ${protein >= proteinTarget ? 'bg-floor' : 'bg-muted/50'}`}
            style={{ width: `${proteinTarget > 0 ? Math.min(100, (protein / proteinTarget) * 100) : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}
