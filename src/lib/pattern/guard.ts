import { moves, moveShape } from './transform'
import type { Grid } from './types'

// Finds hooked crosses: a connected shape in one colour that is unchanged by a quarter turn
// about the grid centre but changed by a mirror. That is the shape of a swastika (and of
// pinwheels with arms). Plain crosses, rings and squares are mirror-symmetric, so they pass.
export function hooked(grid: Grid): boolean {
  const n = grid.length
  const m = n - 1
  const seen = new Set<string>()
  const key = (x: number, y: number) => `${x},${y}`

  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const role = grid[y][x].role
      if (role === 0 || seen.has(key(x, y))) continue
      // Flood fill this colour
      const part = new Map<string, string>()
      const stack = [[x, y]]
      while (stack.length) {
        const [cx, cy] = stack.pop()!
        const k = key(cx, cy)
        if (cx < 0 || cy < 0 || cx > m || cy > m || part.has(k) || grid[cy][cx].role !== role) continue
        part.set(k, JSON.stringify(grid[cy][cx].shape ?? { kind: 'full' }))
        seen.add(k)
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
      }
      if (part.size < 5) continue
      const same = (g: (typeof moves)[keyof typeof moves]) =>
        [...part].every(([k, shape]) => {
          const [px, py] = k.split(',').map(Number)
          const [tx, ty] = g(px, py, m)
          const moved = JSON.stringify(moveShape(JSON.parse(shape), g))
          return part.get(key(tx, ty)) === moved
        })
      if (same(moves.r90) && !same(moves.mx) && !same(moves.diag)) return true
    }
  return false
}
