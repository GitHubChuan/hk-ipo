// 通用排版组件 — 一致的杂志感

import { useState } from 'react'

export function SectionTitle({
  index,
  en,
  zh,
  desc,
}: {
  index: string
  en: string
  zh: string
  desc?: React.ReactNode
}) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-4 border-b border-ink pb-3">
        <span className="font-serif text-4xl text-accent">§{index}</span>
        <div className="flex-1">
          <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">{en}</div>
          <h2 className="font-serif text-3xl">{zh}</h2>
        </div>
      </div>
      {desc && <p className="text-sm text-ink-soft mt-3 italic">{desc}</p>}
    </div>
  )
}

// ─────────────── 关键：白盒 hover 提示 ───────────────
export function InfoTip({
  children,
  title,
  formula,
  steps,
  position = 'top',
}: {
  children: React.ReactNode
  title: string
  formula?: string
  steps?: Array<string | { label: string; value: string | number }>
  position?: 'top' | 'bottom'
}) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      {children}
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-serif border border-ink/40 rounded-full text-ink-mute hover:text-accent hover:border-accent transition-colors">
        i
      </span>
      {open && (
        <span
          className={`absolute z-50 w-72 p-4 border-2 border-ink bg-paper shadow-[0_8px_32px_rgba(26,24,19,0.18)] text-left ${
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-1/2 -translate-x-1/2`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] tracking-[0.3em] uppercase text-accent mb-1">FORMULA · 公式</div>
          <div className="font-serif text-base mb-2 leading-tight">{title}</div>
          {formula && (
            <div className="font-mono text-[11px] bg-paper-2 px-2 py-1.5 border border-rule mb-2 break-words leading-relaxed">
              {formula}
            </div>
          )}
          {steps && steps.length > 0 && (
            <ul className="space-y-1.5 text-xs text-ink-soft">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 leading-snug">
                  <span className="font-serif text-[11px] text-ink-mute mt-0.5">·</span>
                  {typeof s === 'string' ? (
                    <span>{s}</span>
                  ) : (
                    <span className="flex-1 flex justify-between gap-2">
                      <span>{s.label}</span>
                      <span className="font-mono text-ink">{s.value}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </span>
      )}
    </span>
  )
}

export function StatBlock({
  label,
  value,
  unit,
  hint,
  highlight,
  tip,
}: {
  label: string
  value: string | number
  unit?: string
  hint?: string
  highlight?: 'up' | 'down' | 'accent' | 'mute'
  tip?: { title: string; formula?: string; steps?: Array<string | { label: string; value: string | number }> }
}) {
  const color =
    highlight === 'up' ? 'text-accent' :
    highlight === 'down' ? 'text-accent-2' :
    highlight === 'accent' ? 'text-accent' :
    highlight === 'mute' ? 'text-ink-mute' : 'text-ink'
  const labelEl = tip ? <InfoTip {...tip} position="bottom">{label}</InfoTip> : <>{label}</>
  return (
    <div className="border border-rule bg-paper-2/40 p-5 lift">
      <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mb-2">{labelEl}</div>
      <div className={`num display text-4xl ${color}`}>
        {value}
        {unit && <span className="text-base text-ink-soft ml-1 font-sans">{unit}</span>}
      </div>
      {hint && <div className="text-[11px] text-ink-mute mt-2">{hint}</div>}
    </div>
  )
}

export function Tag({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'success' | 'warn' | 'mute'
}) {
  const cls =
    variant === 'accent' ? 'bg-accent text-paper' :
    variant === 'success' ? 'border border-accent-2 text-accent-2' :
    variant === 'warn' ? 'border border-[#C8923A] text-[#C8923A]' :
    variant === 'mute' ? 'border border-rule text-ink-mute' :
    'border border-ink text-ink'
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] tracking-[0.2em] uppercase ${cls}`}>
      {children}
    </span>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="border-2 border-dashed border-rule p-12 text-center bg-paper-2/30">
      <div className="font-serif text-2xl mb-2">{title}</div>
      {hint && <p className="text-sm text-ink-soft mb-5">{hint}</p>}
      {action}
    </div>
  )
}

export function PrimaryButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`bg-ink text-paper px-5 py-2.5 text-xs tracking-[0.2em] uppercase hover:bg-accent transition-colors disabled:opacity-50 ${rest.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`border border-ink text-ink px-5 py-2.5 text-xs tracking-[0.2em] uppercase hover:bg-ink hover:text-paper transition-colors disabled:opacity-50 ${rest.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-[0.25em] uppercase text-ink-soft mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-ink-mute mt-1">{hint}</div>}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-transparent border-b border-ink/50 focus:border-accent outline-none py-1.5 text-sm font-mono ${props.className ?? ''}`}
    />
  )
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }> },
) {
  const { options, ...rest } = props
  return (
    <select
      {...rest}
      className={`w-full bg-transparent border-b border-ink/50 focus:border-accent outline-none py-1.5 text-sm ${rest.className ?? ''}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function HKD(n?: number, withSymbol = true): string {
  if (n === undefined || n === null || isNaN(n)) return '—'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const fmt = abs >= 10000 ? Math.round(abs).toLocaleString() : abs.toFixed(0)
  return `${withSymbol ? 'HK$ ' : ''}${sign}${fmt}`
}

export function Pct(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}
