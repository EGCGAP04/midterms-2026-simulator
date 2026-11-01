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

/** A text with one asterisk, which becomes the mark. */
export function WithRedrawnMark({ text }: { text: string }) {
  const at = text.indexOf('*')
  if (at === -1) return text
  return (
    <>
      {text.slice(0, at)}
      <RedrawnMark />
      {text.slice(at + 1)}
    </>
  )
}
