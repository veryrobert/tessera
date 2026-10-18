import { type Rng, fork, int } from './random'
import { type Cell, type Grid, FULL } from './types'

// Fields: patterns with no block, grown cell by cell from noise, as in the pixel posters.
//   camo     big soft blobs, each colour a region (value noise, thresholded)
//   patches  a mosaic of single squares, neighbours often repeating
//   streaks  horizontal runs of colour of random length, like a glitched scan

export type FieldKind = 'camo' | 'patches' | 'streaks'
export type FieldSpec = { kind: FieldKind; cols: number; rows: number; scale: number } // scale: blob or run size in cells

// Smooth value noise on a lattice `scale` cells apart
function noise(r: Rng, cols: number, rows: number, scale: number) {
  const gw = Math.ceil(cols / scale) + 2, gh = Math.ceil(rows / scale) + 2
  const lattice = Array.from({ length: gw * gh }, () => r())
  const at = (x: number, y: number) => lattice[y * gw + x]
  const ease = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const fx = x / scale, fy = y / scale
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = ease(fx - x0), ty = ease(fy - y0)
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
    return a + (b - a) * ty
  }
}

export function field(seed: number, spec: FieldSpec, roles: number): Grid {
  const r = fork(seed, 6)
  const { cols, rows } = spec
  const scale = Math.max(1, spec.scale)
  const role = (v: number) => Math.min(roles - 1, Math.floor(v * roles))

  if (spec.kind === 'camo') {
    // Two octaves, so edges are pixel-ragged rather than round
    const big = noise(r, cols, rows, scale), small = noise(r, cols, rows, Math.max(1, scale / 3))
    // Stretch the noise so every colour gets a share
    const vals = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => big(x, y) * 0.8 + small(x, y) * 0.2))
    const flat = vals.flat().sort((a, b) => a - b)
    const rank = (v: number) => {
      let lo = 0, hi = flat.length - 1
      while (lo < hi) { const m = (lo + hi) >> 1; if (flat[m] < v) lo = m + 1; else hi = m }
      return lo / flat.length
    }
    return vals.map(row => row.map(v => ({ role: role(rank(v)), shape: FULL })))
  }

  if (spec.kind === 'patches') {
    const out: Grid = []
    for (let y = 0; y < rows; y++) {
      const row: Cell[] = []
      for (let x = 0; x < cols; x++) {
        // Often repeat the cell above or to the left, so patches clump a little
        const k = r()
        const roleHere = k < 0.18 && x ? row[x - 1].role : k < 0.3 && y ? out[y - 1][x].role : int(r, 0, roles - 1)
        row.push({ role: roleHere, shape: FULL })
      }
      out.push(row)
    }
    return out
  }

  // streaks
  return Array.from({ length: rows }, () => {
    const row: Cell[] = []
    while (row.length < cols) {
      const len = Math.max(1, Math.round(-Math.log(1 - r()) * scale)) // mostly short, sometimes long
      const c = int(r, 0, roles - 1)
      for (let i = 0; i < len && row.length < cols; i++) row.push({ role: c, shape: FULL })
    }
    return row
  })
}
