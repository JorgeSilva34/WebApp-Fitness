import { movingAverage } from '../lib/nutrition'
import { formatShort } from '../lib/date'
import type { ISODate } from '../lib/types'

const W = 320
const H = 150
const PAD_L = 30
const PAD_R = 8
const PAD_T = 10
const PAD_B = 20

/** Peso diario (puntos) y media móvil de 7 días (línea). SVG propio: sin
 *  dependencias, funciona sin conexión y respeta el tema. */
export function WeightChart({ weights }: { weights: { date: ISODate; kg: number }[] }) {
  const series = movingAverage(weights)
  if (series.length < 2) {
    return (
      <p className="text-sm text-muted">
        Con dos pesajes o más aparece aquí la gráfica con la media móvil de 7 días.
      </p>
    )
  }

  const values = series.flatMap((p) => [p.kg, p.avg ?? p.kg])
  const min = Math.min(...values) - 0.4
  const max = Math.max(...values) + 0.4
  const span = Math.max(0.8, max - min)

  const t0 = new Date(series[0].date).getTime()
  const t1 = new Date(series[series.length - 1].date).getTime()
  const tSpan = Math.max(1, t1 - t0)

  const x = (d: ISODate) => PAD_L + ((new Date(d).getTime() - t0) / tSpan) * (W - PAD_L - PAD_R)
  const y = (kg: number) => PAD_T + (1 - (kg - min) / span) * (H - PAD_T - PAD_B)

  const avgPath = series
    .filter((p) => p.avg !== null)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.avg as number).toFixed(1)}`)
    .join(' ')

  const ticks = [min + span, min + span / 2, min]

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Evolución del peso corporal entre ${formatShort(series[0].date)} y ${formatShort(
          series[series.length - 1].date,
        )}`}
      >
        {ticks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(v)}
              y2={y(v)}
              stroke="currentColor"
              className="text-line"
              strokeWidth="1"
            />
            <text x={0} y={y(v) + 3} className="fill-current text-muted" style={{ fontSize: 9 }}>
              {v.toFixed(1).replace('.', ',')}
            </text>
          </g>
        ))}

        <path d={avgPath} fill="none" stroke="currentColor" className="text-target" strokeWidth="2" />

        {series.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r="2" className="fill-current text-muted" />
        ))}

        <text x={PAD_L} y={H - 6} className="fill-current text-muted" style={{ fontSize: 9 }}>
          {formatShort(series[0].date)}
        </text>
        <text
          x={W - PAD_R}
          y={H - 6}
          textAnchor="end"
          className="fill-current text-muted"
          style={{ fontSize: 9 }}
        >
          {formatShort(series[series.length - 1].date)}
        </text>
      </svg>
      <figcaption className="mt-1 text-sm text-muted">
        Puntos: pesaje diario. Línea: media móvil de 7 días — es la que marca la tendencia.
      </figcaption>
    </figure>
  )
}
