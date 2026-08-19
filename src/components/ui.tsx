import type { InputHTMLAttributes, ReactNode } from 'react'

export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-5">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card p-4 ${className}`}>{children}</section>
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  )
}

type NumProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: number | ''
  onValue: (v: number | '') => void
  decimals?: boolean
  suffix?: string
}

export function NumberField({ value, onValue, decimals = false, suffix, className = '', ...rest }: NumProps) {
  return (
    <div className="relative">
      <input
        {...rest}
        type="number"
        inputMode={decimals ? 'decimal' : 'numeric'}
        step={decimals ? '0.1' : '1'}
        value={value}
        onChange={(e) => {
          const raw = e.target.value
          onValue(raw === '' ? '' : Number(raw))
        }}
        className={`tap w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-lg tabular-nums text-text placeholder:text-muted/60 ${
          suffix ? 'pr-12' : ''
        } ${className}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>
      )}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'default',
  className = '',
  type = 'button',
  disabled,
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
  'aria-label'?: string
}) {
  const styles = {
    default: 'bg-surface-2 border border-line text-text',
    primary: 'bg-target/20 border border-target/60 text-target font-semibold',
    ghost: 'bg-transparent border border-transparent text-muted',
    danger: 'bg-transparent border border-red-500/50 text-red-300',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`tap rounded-xl px-4 py-2 text-base transition-colors disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`h-8 w-14 shrink-0 rounded-full border transition-colors ${
        checked ? 'border-floor/70 bg-floor/30' : 'border-line bg-surface-2'
      }`}
    >
      <span
        className={`block h-6 w-6 rounded-full bg-text transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`}
      />
    </button>
  )
}

export function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' }) {
  return (
    <p className={`text-sm leading-relaxed ${tone === 'accent' ? 'text-accent' : 'text-muted'}`}>{children}</p>
  )
}
