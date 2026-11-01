// A tooltip opened by a tap has no pointer leaving to close it: it closes
// with a touch anywhere outside its chart instead, a scroll included.

import { useEffect, type RefObject } from 'react'

/** While `open`, calls `close` when a touch or pen lands outside `area`. */
export function useTouchDismiss(area: RefObject<Element | null>, open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return
      if (event.target instanceof Node && area.current?.contains(event.target)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [area, open, close])
}
