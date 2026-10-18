import { memo, useId } from 'react'
import type { Cell, Corner, Item, Pattern, Side } from '@/lib/pattern'

// Draws a pattern as SVG in cell units: one cell is 1×1 in the viewBox.
// Runs of identical full cells in a row are merged, so large plaids stay light.

const corner: Record<Corner, [number, number]> = { nw: [0, 0], ne: [1, 0], se: [1, 1], sw: [0, 1] }

function shapeParts(c: Cell, x: number, y: number, fill: (r: number) => string, key: string) {
  const s = c.shape!
  const base = <rect key={key + 'b'} x={x} y={y} width={1} height={1} fill={fill(c.alt ?? 0)} />
  const f = fill(c.role)
  switch (s.kind) {
    case 'tri': {
      // Triangle with its right angle in that corner
      const [cx, cy] = corner[s.at]
      const pts = [[cx, cy], [1 - cx, cy], [cx, 1 - cy]].map(([px, py]) => `${x + px},${y + py}`).join(' ')
      return [base, <polygon key={key} points={pts} fill={f} />]
    }
    case 'quarter': {
      const [cx, cy] = corner[s.at]
      const ox = x + cx, oy = y + cy
      const sweep = (cx === cy) ? 1 : 0
      const a = [ox + (cx ? -1 : 1), oy], b = [ox, oy + (cy ? -1 : 1)]
      return [base, <path key={key} d={`M${ox},${oy}L${a[0]},${a[1]}A1,1 0 0 ${sweep} ${b[0]},${b[1]}Z`} fill={f} />]
    }
    case 'half': {
      const d: Record<Side, string> = {
        n: `M${x},${y}h1a.5,.5 0 0 1 -1,0Z`,
        s: `M${x},${y + 1}h1a.5,.5 0 0 0 -1,0Z`,
        w: `M${x},${y}v1a.5,.5 0 0 0 0,-1Z`,
        e: `M${x + 1},${y}v1a.5,.5 0 0 1 0,-1Z`,
      }
      return [base, <path key={key} d={d[s.at]} fill={f} />]
    }
    case 'split': {
      const r = { n: [0, 0, 1, 0.5], s: [0, 0.5, 1, 0.5], w: [0, 0, 0.5, 1], e: [0.5, 0, 0.5, 1] }[s.at]
      return [base, <rect key={key} x={x + r[0]} y={y + r[1]} width={r[2]} height={r[3]} fill={f} />]
    }
    case 'bars': {
      const w = 1 / (s.count * 2 - 1) // bars and gaps, role on both outer edges
      return [base, ...Array.from({ length: s.count }, (_, i) =>
        s.dir === 'v'
          ? <rect key={key + i} x={x + i * 2 * w} y={y} width={w} height={1} fill={f} />
          : <rect key={key + i} x={x} y={y + i * 2 * w} width={1} height={w} fill={f} />)]
    }
    case 'full':
      return []
  }
}

// A composed shape: a rect, or a circle or dome cut from one, filled flat or with stripes
function itemParts(it: Item, fill: (r: number) => string, key: string) {
  const { x, y, w, h } = it
  const body = it.stripes
    ? (() => {
        const n = it.stripes.count * 2, v = it.stripes.dir === 'v', step = (v ? w : h) / n
        return [<rect key="b" x={x} y={y} width={w} height={h} fill={fill(it.stripes.alt)} />,
          ...Array.from({ length: it.stripes.count }, (_, k) => v
            ? <rect key={k} x={x + 2 * k * step} y={y} width={step} height={h} fill={fill(it.role)} />
            : <rect key={k} x={x} y={y + 2 * k * step} width={w} height={step} fill={fill(it.role)} />)]
      })()
    : [<rect key="b" x={x} y={y} width={w} height={h} fill={fill(it.role)} />]
  if (it.kind === 'rect') return <g key={key}>{body}</g>
  const rad = Math.min(w, h) / 2, cx = x + w / 2
  const outline = it.kind === 'circle'
    ? <circle cx={cx} cy={y + h / 2} r={rad} />
    : <path d={`M${x},${y + h}V${y + rad}A${rad},${rad} 0 0 1 ${x + w},${y + rad}V${y + h}Z`} />
  return (
    <g key={key}>
      <clipPath id={key}>{outline}</clipPath>
      <g clipPath={`url(#${key})`}>{body}</g>
    </g>
  )
}

// lines: a light cell grid over the pattern, for editing (marked data-overlay so exports can drop it)
export const PatternSvg = memo(function PatternSvg({ pattern, className, lines }: { pattern: Pattern; className?: string; lines?: boolean }) {
  const { grid, colours } = pattern
  const id = useId()
  const H = grid.length, W = grid[0]?.length ?? 0
  const fill = (r: number) => colours[r % colours.length]
  const parts: React.ReactNode[] = []

  grid.forEach((row, y) => {
    let x = 0
    while (x < W) {
      const c = row[x]
      if (!c.shape || c.shape.kind === 'full') {
        let end = x + 1
        while (end < W && (!row[end].shape || row[end].shape!.kind === 'full') && row[end].role === c.role) end++
        parts.push(<rect key={`${x},${y}`} x={x} y={y} width={end - x} height={1} fill={fill(c.role)} />)
        x = end
      } else {
        parts.push(...shapeParts(c, x, y, fill, `${x},${y}`))
        x++
      }
    }
  })

  pattern.items?.forEach((it, i) => parts.push(itemParts(it, fill, `${id}i${i}`)))
  const v = pattern.view ?? { x: 0, y: 0, w: W, h: H }
  const box = `${v.x} ${v.y} ${v.w} ${v.h}`
  const mask = pattern.mask
  // The grid runs past the frame when it's scaled, and an SVG paints outside its viewBox
  // wherever the element is a different shape, so clip to the frame
  const overlay = lines && (
    // White lines with a difference blend: they read as a light grid on dark colours and a dark one on light
    <g data-overlay stroke="rgb(255 255 255 / 0.5)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" style={{ mixBlendMode: 'difference' }}>
      <path vectorEffect="non-scaling-stroke" d={[
        ...Array.from({ length: Math.floor(v.w) + 2 }, (_, i) => `M${Math.ceil(v.x) + i},${v.y}v${v.h}`),
        ...Array.from({ length: Math.floor(v.h) + 2 }, (_, i) => `M${v.x},${Math.ceil(v.y) + i}h${v.w}`),
      ].join('')} />
    </g>
  )
  const frame = <clipPath id={id + 'f'}><rect x={v.x} y={v.y} width={v.w} height={v.h} /></clipPath>
  if (!mask) {
    return (
      <svg viewBox={box} className={className} shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet">
        <defs>{frame}</defs>
        <g clipPath={`url(#${id}f)`}>{parts}{overlay}</g>
      </svg>
    )
  }
  // Cut to a shape, centred, with one colour around it
  const m = Math.min(v.w, v.h) * (1 - mask.inset) / 2, cx = v.x + v.w / 2, cy = v.y + v.h / 2
  const clip = {
    circle: <circle cx={cx} cy={cy} r={m} />,
    arch: <path d={`M${cx - m},${cy + m}V${cy}A${m},${m} 0 0 1 ${cx + m},${cy}V${cy + m}Z`} />,
    diamond: <polygon points={`${cx},${cy - m} ${cx + m},${cy} ${cx},${cy + m} ${cx - m},${cy}`} />,
    none: null,
  }[mask.shape]
  return (
    <svg viewBox={box} className={className} preserveAspectRatio="xMidYMid meet">
      <defs><clipPath id={id}>{clip}</clipPath>{frame}</defs>
      <rect x={v.x} y={v.y} width={v.w} height={v.h} fill={fill(mask.role)} />
      <g clipPath={`url(#${id}f)`}><g clipPath={`url(#${id})`} shapeRendering="crispEdges">{parts}</g></g>
    </svg>
  )
})

// For export: the same drawing as an SVG string, via the DOM node
export const svgString = (el: SVGSVGElement) => new XMLSerializer().serializeToString(el)
