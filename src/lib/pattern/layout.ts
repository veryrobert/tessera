import { colourways } from './palette'
import { fork } from './random'
import { type MoveName, moveGrid, moves } from './transform'
import type { Cell, Grid } from './types'
import { hooked } from './guard'

// Repeats a block across the canvas. Each tile can be turned or flipped, recoloured
// with a colourway, and separated by sashing (the strips between quilt blocks)
// with posts where strips cross.

export type Repeat = 'grid' | 'mirror' | 'twist' | 'pinwheel' | 'half drop' | 'brick' | 'step' | 'lattice'
export type Cycle = 'alternate' | 'diagonal' | 'random'

export type LayoutSpec = {
  cols: number // tiles across
  rows: number // tiles down
  repeat: Repeat
  invert: boolean // swap ground and figure on alternate tiles
  sashing: number // cells between tiles, 0 for none
  sashRole: number
  postRole: number | null // null for no posts
  colourways: number // 1 keeps every tile the same
  cycle: Cycle
  shift?: number // step: cells each row slides; lattice: size of the small square (default 1)
  palettes?: number // more than 1: tiles take turns between that many palettes (see build)
  seed: number
}

export function tile(block: Grid, spec: LayoutSpec, roles: number, waysOverride?: number[][]): Grid {
  const bh = block.length, bw = block[0].length, n = bw
  const s = spec.sashing
  const pw = bw + s, ph = bh + s // one tile plus its strip
  const W = spec.cols * pw + s
  const H = spec.rows * ph + s
  const ways = waysOverride ?? colourways(spec.seed, spec.colourways, roles)
  const pickWay = fork(spec.seed, 3)
  const wayFor = new Map<string, number[]>()

  // Pre-turn the block four ways and flip it, rather than per cell
  const turned: Record<string, Grid> = {}
  const get = (name: MoveName) => (turned[name] ??= moveGrid(block, moves[name]))

  // A pinwheel repeat turns four tiles around a shared corner. If that makes a hooked cross, mirror instead.
  let repeat = spec.repeat
  // Turning and the lattice need square tiles; rectangles mirror instead
  if (bw !== bh && (repeat === 'pinwheel' || repeat === 'lattice')) repeat = 'mirror'
  if (repeat === 'pinwheel') {
    const q = [get('id'), get('r90'), get('r270'), get('r180')]
    const four: Grid = Array.from({ length: 2 * n }, (_, y) =>
      Array.from({ length: 2 * n }, (_, x) => q[(x >= n ? 1 : 0) + (y >= n ? 2 : 0)][y % n][x % n]))
    if (hooked(four)) repeat = 'mirror'
  }

  // Lattice: big squares (the block) and small squares (posts) tile the plane together,
  // each row of blocks stepping down by the post size. Known as a Pythagorean tiling.
  const k = spec.shift ?? 1
  const latticeCell = (x: number, y: number): Cell => {
    const a = n, d = a * a + k * k
    const i0 = Math.floor((a * x + k * y) / d), j0 = Math.floor((a * y - k * x) / d)
    for (let i = i0 - 1; i <= i0 + 1; i++)
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        const lx = x - i * a + j * k, ly = y - i * k - j * a
        if (lx >= 0 && ly >= 0 && lx < a && ly < a) {
          const c = block[ly][lx]
          const way = ways[Math.abs(i + j) % ways.length]
          return { ...c, role: way[c.role] ?? c.role, alt: c.alt === undefined ? undefined : way[c.alt] ?? c.alt }
        }
        if (lx >= a && lx < a + k && ly >= 0 && ly < k) return { role: spec.postRole ?? spec.sashRole }
      }
    return { role: spec.sashRole }
  }

  const out: Grid = []
  for (let gy = 0; gy < H; gy++) {
    const row: Cell[] = []
    for (let gx = 0; gx < W; gx++) {
      // Shift alternate columns or rows by half a tile
      if (repeat === 'lattice') {
        row.push(latticeCell(gx, gy))
        continue
      }
      let x = gx - s, y = gy - s
      const cx = Math.floor(x / pw)
      if (spec.repeat === 'half drop' && cx % 2) y += Math.floor(ph / 2)
      const cy = Math.floor(y / ph)
      if (spec.repeat === 'brick' && cy % 2) x += Math.floor(pw / 2)
      if (spec.repeat === 'step') x -= cy * (spec.shift ?? 1) // each row slides one cell, so posts run diagonally
      const tx = Math.floor(x / pw), ty = Math.floor(y / ph)
      const lx = ((x % pw) + pw) % pw, ly = ((y % ph) + ph) % ph

      if (lx >= bw || ly >= bh || gx < s || gy < s) {
        const inX = lx >= bw || gx < s, inY = ly >= bh || gy < s
        row.push({ role: inX && inY && spec.postRole !== null ? spec.postRole : spec.sashRole })
        continue
      }

      const odd = (k: number) => ((k % 2) + 2) % 2 === 1
      let move: MoveName = 'id'
      if (repeat === 'mirror') move = odd(tx) ? (odd(ty) ? 'r180' : 'mx') : odd(ty) ? 'my' : 'id'
      // Mirrored the other way, so corners meet on the diagonal
      if (repeat === 'twist') move = odd(tx) ? (odd(ty) ? 'r180' : 'my') : odd(ty) ? 'mx' : 'id'
      if (repeat === 'pinwheel') move = (['id', 'r90', 'r270', 'r180'] as const)[(odd(tx) ? 1 : 0) + (odd(ty) ? 2 : 0)]
      const c = get(move)[ly][lx]

      const key = `${tx},${ty}`
      let way = wayFor.get(key)
      if (!way) {
        const k = spec.cycle === 'alternate' ? Math.abs(tx + ty) : spec.cycle === 'diagonal' ? Math.abs(tx - ty) : Math.floor(pickWay() * ways.length)
        way = ways[k % ways.length]
        wayFor.set(key, way)
      }
      const flip = spec.invert && odd(tx + ty)
      const recolour = (role: number) => {
        const r = flip && role < 2 ? 1 - role : role
        return way[r] ?? r
      }
      row.push({ ...c, role: recolour(c.role), alt: c.alt === undefined ? undefined : recolour(c.alt) })
    }
    out.push(row)
  }
  return out
}
