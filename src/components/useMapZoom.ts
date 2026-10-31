// Zoom and pan for the House maps (docs/SPEC.md §4.4), with d3-zoom: the
// wheel or a pinch zooms the map (never the page), dragging moves it, and the
// zoom buttons do both from the keyboard.

import { select } from 'd3-selection'
import { zoom, zoomIdentity, zoomTransform, type D3ZoomEvent, type ZoomTransform } from 'd3-zoom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

/** Each zoom button's step. */
const BUTTON_STEP = 2
/** How far the mouse may move during a click before it counts as a drag. */
const CLICK_DISTANCE = 3

/** Which events start a zoom or a pan. One finger pans only once zoomed in:
 * before that it scrolls the page, as anywhere else. */
function startsZoom(this: Element, event: Event): boolean {
  if (event instanceof MouseEvent) return event.button === 0
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    return event.touches.length > 1 || zoomTransform(this).k > 1
  }
  return true
}

/** `maxZoom`: how far in the map zooms. */
export function useMapZoom(width: number, height: number, maxZoom: number) {
  // A callback ref: the district map's <svg> appears only once it has loaded.
  const [svg, ref] = useState<SVGSVGElement | null>(null)
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)

  const behaviour = useMemo(
    () =>
      zoom<SVGSVGElement, unknown>()
        .extent([
          [0, 0],
          [width, height],
        ])
        .translateExtent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([1, maxZoom])
        .clickDistance(CLICK_DISTANCE)
        .filter(startsZoom)
        .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => setTransform(event.transform)),
    [width, height, maxZoom],
  )

  useEffect(() => {
    if (!svg) return
    // No double-click zoom: a second click on a race clears its selection.
    const selection = select(svg).call(behaviour).on('dblclick.zoom', null)
    // The wheel over the map is always the map's: at the widest zoom d3-zoom
    // would let it scroll the page.
    const keepWheel = (event: WheelEvent) => event.preventDefault()
    svg.addEventListener('wheel', keepWheel, { passive: false })
    return () => {
      selection.on('.zoom', null)
      svg.removeEventListener('wheel', keepWheel)
    }
  }, [svg, behaviour])

  const zoomBy = (factor: number) => {
    if (svg) select(svg).call(behaviour.scaleBy, factor)
  }

  const zoomed = transform.k > 1
  return {
    /** For the map's `<svg>`. */
    ref,
    transform,
    zoomed,
    /** For the map's `<svg>`: its zoom level, to keep labels at their size. */
    style: { '--k': transform.k } as CSSProperties,
    /** A point on the map, in map units, where it is now drawn; undefined
     * when it is out of view. */
    place: (at: readonly [number, number]): [number, number] | undefined => {
      const [x, y] = transform.apply([at[0], at[1]])
      return x >= 0 && x <= width && y >= 0 && y <= height ? [x, y] : undefined
    },
    /** Brings a point into view (centred), if it is out of view. */
    follow: (at: readonly [number, number]) => {
      const [x, y] = transform.apply([at[0], at[1]])
      if (svg && (x < 0 || x > width || y < 0 || y > height)) select(svg).call(behaviour.translateTo, at[0], at[1])
    },
    zoomIn: () => zoomBy(BUTTON_STEP),
    zoomOut: () => zoomBy(1 / BUTTON_STEP),
    reset: () => {
      if (svg) select(svg).call(behaviour.transform, zoomIdentity)
    },
    canZoomIn: transform.k < maxZoom,
  }
}

export type MapZoom = ReturnType<typeof useMapZoom>
