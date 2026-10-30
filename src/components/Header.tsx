// Header (docs/SPEC.md §4.1): title, chamber switch and language toggle.

import { useI18n } from '../i18n/context.ts'
import { LANGS, translate, type Lang } from '../i18n/i18n.ts'
import type { Chamber } from '../model/types.ts'
import { Toggle } from './Toggle.tsx'

interface HeaderProps {
  chamber: Chamber
  onChamberChange: (chamber: Chamber) => void
  onLangChange: (lang: Lang) => void
}

export function Header({ chamber, onChamberChange, onLangChange }: HeaderProps) {
  const { lang, t } = useI18n()
  return (
    <header className="header">
      <div>
        <h1>{t('app.title')}</h1>
        <p className="subtitle">{t('app.subtitle')}</p>
      </div>
      <div className="header-controls">
        <Toggle
          label={t('chamber.label')}
          options={[
            { value: 'house', label: t('chamber.house') },
            { value: 'senate', label: t('chamber.senate') },
          ]}
          value={chamber}
          onChange={onChamberChange}
        />
        <Toggle
          label={t('lang.label')}
          // Each language is named in itself, whatever the page language.
          options={LANGS.map((code) => ({
            value: code,
            label: code.toUpperCase(),
            title: translate(code, `lang.${code}`),
            lang: code,
          }))}
          value={lang}
          onChange={onLangChange}
        />
      </div>
    </header>
  )
}
