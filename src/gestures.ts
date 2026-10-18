import { useEffect, useRef, type RefObject } from 'react'

// Zoom by gesture, locked to whole steps so it clicks: pinch, drag up or down, or the wheel and
// trackpad pinch on desktop. Each step pulses the pattern and ticks on phones that can vibrate.

const DRAG_STEP = 36 // px of drag per step
const WHEEL_STEP = 60 // wheel delta per step

type Options = {
  value: () => number | null // null when there's nothing to zoom
  set: (n: number) => void
  begin: () => void // once per gesture, before its first step (for undo)
  min: number
  max: number
}

export function useStepZoom(el: RefObject<HTMLElement | null>, options: Options) {
  const opts = useRef(options)
  opts.current = options

  useEffect(() => {
    const node = el.current
    if (!node) return
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    const pointers = new Map<number, { x: number; y: number }>()
    let start: { v: number; y: number; d: number; began: boolean } | null = null
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
      const ys = [...pointers.values()].map(p => p.y)
      start = { v, y: ys.reduce((s, y) => s + y, 0) / ys.length, d: pointers.size === 2 ? spread() : 0, began: start?.began ?? false }
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
        // Drag down for more blocks, up for fewer
        step(start.v + Math.round((e.clientY - start.y) / DRAG_STEP))
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
      if (!start) { start = { v, y: 0, d: 0, began: false }; current = v }
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
