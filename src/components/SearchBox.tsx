// A search field with suggestions (docs/SPEC.md §4.4): an accessible
// combobox. The race search and the local adjustments' search use it.

import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatCount } from '../i18n/format.ts'
import { searchRaces, type SearchEntry } from '../state/search.ts'

interface SearchBoxProps<T> {
  /** What can be found, and how (`entries[k]` describes `items[k]`). */
  items: readonly T[]
  entries: readonly SearchEntry[]
  label: string
  placeholder: string
  itemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  /** An item picked from the suggestions. */
  onPick: (item: T) => void
}

export function SearchBox<T>({ items, entries, label, placeholder, itemKey, renderItem, onPick }: SearchBoxProps<T>) {
  const { lang, t } = useI18n()
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  /** The highlighted suggestion, or -1 for none (Enter then picks the first). */
  const [active, setActive] = useState(-1)

  const results = useMemo(() => searchRaces(entries, query), [entries, query])
  const showing = open && query.trim() !== ''
  const optionId = (k: number) => `${id}-option-${k}`

  const pick = (k: number) => {
    // The field empties, ready for the next search.
    setQuery('')
    setOpen(false)
    setActive(-1)
    onPick(items[k])
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setOpen(true)
        setActive((current) => Math.min(current + 1, results.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((current) => Math.max(current - 1, 0))
        break
      case 'Enter':
        if (showing && results.length > 0) {
          event.preventDefault()
          pick(results[Math.max(active, 0)])
        }
        break
      case 'Escape':
        // First it closes the suggestions, then it clears the field (the
        // browser's own clearing of a search field waits for the second).
        if (showing) {
          event.preventDefault()
          setOpen(false)
        } else setQuery('')
        setActive(-1)
        break
    }
  }

  return (
    <div className="search">
      <label className="visually-hidden" htmlFor={`${id}-input`}>
        {label}
      </label>
      <input
        id={`${id}-input`}
        className="search-input"
        type="search"
        role="combobox"
        aria-expanded={showing && results.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={showing && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul id={`${id}-list`} className="search-list" role="listbox" aria-label={label} hidden={!showing || results.length === 0}>
        {showing &&
          results.map((k, position) => (
            <li
              key={itemKey(items[k])}
              id={optionId(position)}
              role="option"
              aria-selected={position === active}
              className="search-option"
              // Keep the focus in the field, so it does not close first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(k)}
            >
              {renderItem(items[k])}
            </li>
          ))}
      </ul>
      {showing && results.length === 0 && (
        <p className="search-none" aria-hidden="true">
          {t('search.none')}
        </p>
      )}
      <p className="visually-hidden" aria-live="polite">
        {showing && (results.length > 0 ? t('search.count', { count: formatCount(lang, results.length) }) : t('search.none'))}
      </p>
    </div>
  )
}
