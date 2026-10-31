// A segmented control: a group of buttons, one of them pressed.

import type { ReactNode } from 'react'

export interface ToggleOption<T extends string> {
  value: T
  label: ReactNode
  /** A longer name for screen readers and the tooltip (required when the
   * label is an icon). */
  title?: string
  /** The option's own language, when its label is in another one. */
  lang?: string
}

interface ToggleProps<T extends string> {
  label: string
  options: readonly ToggleOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function Toggle<T extends string>({ label, options, value, onChange }: ToggleProps<T>) {
  return (
    <div className="toggle" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          aria-label={option.title}
          title={option.title}
          lang={option.lang}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
