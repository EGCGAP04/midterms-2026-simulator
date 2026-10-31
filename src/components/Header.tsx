// Header (docs/SPEC.md §4.1): title, chamber switch, language and theme toggles.

import { useI18n } from '../i18n/context.ts'
import { LANGS, translate, type Lang } from '../i18n/i18n.ts'
import type { Chamber } from '../model/types.ts'
import type { Theme } from '../state/theme.ts'
import { Toggle } from './Toggle.tsx'

interface HeaderProps {
  chamber: Chamber
  theme: Theme
  onChamberChange: (chamber: Chamber) => void
  onLangChange: (lang: Lang) => void
  onThemeChange: (theme: Theme) => void
}

const SunIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
)

const MoonIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
)

export function Header({ chamber, theme, onChamberChange, onLangChange, onThemeChange }: HeaderProps) {
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
        <Toggle
          label={t('theme.label')}
          options={[
            { value: 'light', label: <SunIcon />, title: t('theme.light') },
            { value: 'dark', label: <MoonIcon />, title: t('theme.dark') },
          ]}
          value={theme}
          onChange={onThemeChange}
        />
      </div>
    </header>
  )
}
