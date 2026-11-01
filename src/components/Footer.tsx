// Footer (docs/SPEC.md §4.9): the author and the licenses, so whoever
// reuses the forecast knows whom to credit.

import { useI18n } from '../i18n/context.ts'

const AUTHOR = 'Enzo Agustín Aguirre Polenta'
const REPO = 'https://github.com/EGCGAP04/midterms-2026-simulator'
const APACHE = 'https://www.apache.org/licenses/LICENSE-2.0'

export function Footer() {
  const { lang, t } = useI18n()
  // Creative Commons has the license summary in Spanish too.
  const ccBy = `https://creativecommons.org/licenses/by/4.0/${lang === 'es' ? 'deed.es' : ''}`
  return (
    <footer className="footer">
      <p>
        © 2026 {AUTHOR} · {t('footer.code')}: <a href={APACHE}>Apache 2.0</a> · {t('footer.forecast')}:{' '}
        <a href={ccBy}>CC BY 4.0</a> · <a href={REPO}>GitHub</a>
      </p>
    </footer>
  )
}
