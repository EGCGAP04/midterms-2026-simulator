// The asterisk after a district redrawn for 2026 (docs/SPEC.md §4.5, §4.7):
// screen readers hear what it means instead.

import { useI18n } from '../i18n/context.ts'

export function RedrawnMark() {
  const { t } = useI18n()
  return (
    <>
      <span aria-hidden="true">*</span>
      <span className="visually-hidden"> {t('redrawn.label')}</span>
    </>
  )
}

