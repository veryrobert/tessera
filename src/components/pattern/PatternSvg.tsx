import { memo, useId } from 'react'
import type { Cell, Corner, Pattern, Side } from '@/lib/pattern'

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

export const PatternSvg = memo(function PatternSvg({ pattern, className }: { pattern: Pattern; className?: string }) {
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

  const mask = pattern.mask
  if (!mask) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet">
        {parts}
      </svg>
    )
  }
  // Cut to a shape, centred, with one colour around it
  const m = Math.min(W, H) * (1 - mask.inset) / 2, cx = W / 2, cy = H / 2
  const clip = {
    circle: <circle cx={cx} cy={cy} r={m} />,
    arch: <path d={`M${cx - m},${cy + m}V${cy}A${m},${m} 0 0 1 ${cx + m},${cy}V${cy + m}Z`} />,
    diamond: <polygon points={`${cx},${cy - m} ${cx + m},${cy} ${cx},${cy + m} ${cx - m},${cy}`} />,
    none: null,
  }[mask.shape]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="xMidYMid meet">
      <defs><clipPath id={id}>{clip}</clipPath></defs>
      <rect width={W} height={H} fill={fill(mask.role)} />
      <g clipPath={`url(#${id})`} shapeRendering="crispEdges">{parts}</g>
    </svg>
  )
})

// For export: the same drawing as an SVG string, via the DOM node
export const svgString = (el: SVGSVGElement) => new XMLSerializer().serializeToString(el)
