import { useEffect, useRef, type RefObject } from 'react'

// Gestures on the pattern, each locked to whole steps so it clicks:
//   pinch (or the wheel and trackpad pinch) zooms, a whole block at a time, with a pulse
//   one finger or the mouse drags the pattern under the frame, a whole cell at a time
// Steps tick on phones that can vibrate.

const WHEEL_STEP = 60 // wheel delta per step

type Options = {
  value: () => number | null // null when there's nothing to zoom
  set: (n: number) => void
  begin: () => void // once per gesture, before its first step (for undo)
  min: number
  max: number
  // Sliding: the current offset in cells, setting it, and how many px one cell is on screen
  offset: () => [number, number]
  slide: (x: number, y: number) => void
  cellPx: () => number
}

export function useStepZoom(el: RefObject<HTMLElement | null>, options: Options) {
  const opts = useRef(options)
  opts.current = options

  useEffect(() => {
    const node = el.current
    if (!node) return
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    const pointers = new Map<number, { x: number; y: number }>()
    let start: { v: number; x: number; y: number; d: number; o: [number, number]; at: [number, number]; began: boolean } | null = null
    let current = 0
    let wheel = 0, wheelTimer = 0

    const step = (to: number) => {
      const { min, max, set, begin } = opts.current
      const n = Math.max(min, Math.min(max, to))
      if (n === current) return
      if (start && !start.began) { begin(); start.began = true }
      current = n
      set(n)
      navigator.vibrate?.(6)
      if (!calm) node.querySelector('svg')?.animate([{ transform: 'scale(1.015)' }, { transform: 'scale(1)' }], { duration: 140, easing: 'ease-out' })
    }
    const spread = () => {
      const [a, b] = [...pointers.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const reset = () => {
      const v = opts.current.value()
      if (v === null) { start = null; return }
      current = v
      const ps = [...pointers.values()]
      const o = opts.current.offset()
      start = { v, x: ps[0].x, y: ps[0].y, d: pointers.size === 2 ? spread() : 0, o, at: o, began: start?.began ?? false }
    }

    const down = (e: PointerEvent) => {
      if (pointers.size >= 2) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      node.setPointerCapture(e.pointerId)
      reset() // a second finger restarts from where the drag got to
    }
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId) || !start) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2 && start.d > 0) {
        // Spread to zoom in (fewer, bigger blocks), pinch to zoom out
        step(Math.round(start.v / (spread() / start.d)))
      } else if (pointers.size === 1) {
        // Slide the pattern, a whole cell at a time
        const c = Math.max(1, opts.current.cellPx())
        const to: [number, number] = [start.o[0] + Math.round((e.clientX - start.x) / c), start.o[1] + Math.round((e.clientY - start.y) / c)]
        if (to[0] === start.at[0] && to[1] === start.at[1]) return
        if (!start.began) { opts.current.begin(); start.began = true }
        start.at = to
        opts.current.slide(...to)
        navigator.vibrate?.(4)
      }
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size) reset()
      else start = null
    }
    const onWheel = (e: WheelEvent) => {
      const v = opts.current.value()
      if (v === null) return
      e.preventDefault()
      // Trackpad pinch arrives as ctrl+wheel with small deltas; scale it up to match
      wheel += e.ctrlKey ? e.deltaY * 4 : e.deltaY
      clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(() => { wheel = 0 }, 200)
      if (Math.abs(wheel) < WHEEL_STEP) return
      if (!start) { start = { v, x: 0, y: 0, d: 0, o: [0, 0], at: [0, 0], began: false }; current = v }
      step(current + Math.sign(wheel))
      wheel = 0
      window.setTimeout(() => { if (!pointers.size) start = null }, 300)
    }

    node.addEventListener('pointerdown', down)
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
      node.removeEventListener('wheel', onWheel)
      clearTimeout(wheelTimer)
    }
  }, [el])
}
