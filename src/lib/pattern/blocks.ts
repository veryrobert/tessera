import { type Rng, int, pick, weighted } from './random'
import { type Move, moves, moveCell, sameShape } from './transform'
import { hooked } from './guard'
import { type Cell, type Corner, type Grid, type Shape, type Side, FULL } from './types'

// ---------- Library ----------
// Rows of characters. A digit is a full cell in that role. A letter is looked up in the legend.

type Def = { rows: string[]; legend?: Record<string, Cell> }

const parse = ({ rows, legend = {} }: Def): Grid =>
  rows.map(r => [...r].map(ch => (/\d/.test(ch) ? { role: +ch, shape: FULL } : legend[ch])))

const tri = (role: number, at: Corner, alt = 0): Cell => ({ role, alt, shape: { kind: 'tri', at } })
const split = (role: number, at: Side, alt = 0): Cell => ({ role, alt, shape: { kind: 'split', at } })
const half = (role: number, at: Side, alt = 0): Cell => ({ role, alt, shape: { kind: 'half', at } })
const quarter = (role: number, at: Corner, alt = 0): Cell => ({ role, alt, shape: { kind: 'quarter', at } })
const bars = (role: number, dir: 'h' | 'v', count: number, alt = 0): Cell => ({ role, alt, shape: { kind: 'bars', dir, count } })

// Post in one corner, a strip along each of the two sides that meet there, figure filling the rest.
// One block, five looks: alone, mirrored (framed square), twisted, bricked, or recoloured.
export function cornerBlock(size = 4, strip = 1, post = 2): Grid {
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const role = x < strip && y < strip ? post : y < strip ? 4 : x < strip ? 3 : 1
      return { role, shape: FULL }
    }))
}

export const library = {
  corner: cornerBlock(4, 1),
  'corner wide': cornerBlock(7, 2),
  'corner open': cornerBlock(4, 1, 4), // no post in the block; use with lattice, which adds one
  // Checker of pink and pale where every square wears the same notched cap, so they read as blobs
  'capped check': parse({ rows: ['01100110', '11111000', '11111000', '11111000', '01100110', '10001111', '10001111', '10001111'] }),
  plain: [[{ role: 0, shape: FULL }, { role: 0, shape: FULL }], [{ role: 0, shape: FULL }, { role: 0, shape: FULL }]],
  'four patch': parse({ rows: ['10', '01'] }),
  'nine patch': parse({ rows: ['101', '010', '101'] }),
  'double nine patch': parse({ rows: ['10101', '01010', '10201', '01010', '10101'] }),
  'antique tile': parse({ rows: ['21112', '10301', '13031', '10301', '21112'] }),
  'roman square': parse({ rows: ['123', '123', '123'] }),
  'rail fence': parse({ rows: ['1211', '1222', '1112', '2212'] }),
  'log cabin': parse({ rows: ['333333', '322223', '321123', '321123', '322223', '333333'] }),
  'courthouse steps': parse({ rows: ['22222', '13331', '13031', '13331', '22222'] }),
  checker: parse({ rows: ['1010', '0101', '1010', '0101'] }),
  'basket weave': parse({ rows: ['1120', '1120', '2011', '2011'] }),
  'framed square': parse({ rows: ['2112', '1001', '1001', '2112'] }),
  'churn dash': parse({
    rows: ['abc', 'd0e', 'fgh'],
    legend: {
      a: tri(1, 'nw'), b: split(1, 'n'), c: tri(1, 'ne'),
      d: split(1, 'w'), e: split(1, 'e'),
      f: tri(1, 'sw'), g: split(1, 's'), h: tri(1, 'se'),
    },
  }),
  pinwheel: parse({
    rows: ['ab', 'cd'],
    legend: { a: tri(1, 'ne'), b: tri(1, 'se'), c: tri(1, 'nw'), d: tri(1, 'sw') },
  }),
  'flying geese': parse({
    rows: ['ab', 'ab'],
    legend: { a: tri(1, 'ne'), b: tri(1, 'nw') },
  }),
  // Big shapes, from the Amsterdam signs: diagonal halves, domes, blocks of flat colour
  'sign': parse({
    rows: ['ab', 'cd'],
    legend: { a: half(3, 's', 1), b: half(4, 's', 2), c: tri(1, 'sw', 3), d: tri(2, 'ne', 4) },
  }),
  'diagonals': parse({ rows: ['ab', 'ba'], legend: { a: tri(1, 'sw', 3), b: tri(2, 'ne', 4) } }),
  'domes': parse({ rows: ['aa', '12'], legend: { a: half(3, 's', 4) } }),
  // Stripes in blocks and balls, from the Duluth wrappers
  'stripe blocks': parse({ rows: ['ab', 'ba'], legend: { a: bars(1, 'v', 3, 2), b: bars(3, 'h', 3, 4) } }),
  'stripe balls': parse({ rows: ['ab', 'cd'], legend: { a: quarter(1, 'se', 0), b: quarter(1, 'sw', 0), c: quarter(1, 'ne', 0), d: quarter(1, 'nw', 0) } }),
  // Square in a square with corner posts, the scrap-quilt block
  'square in square': parse({ rows: ['31113', '12221', '12421', '12221', '31113'] }),
  'log steps': parse({ rows: ['2222', '1333', '1403', '1443'] }),
} satisfies Record<string, Grid>

export type LibraryName = keyof typeof library

// ---------- Generator ----------
// Pick a symmetry, fill one cell at a time with something random, and copy it to every
// position the symmetry links it to. Quilt blocks are mostly d4 or rot4.

export const symmetries = {
  none: ['id'],
  mirror: ['id', 'mx'],
  'mirror both': ['id', 'mx', 'my', 'r180'],
  rotate: ['id', 'r90', 'r180', 'r270'],
  diagonal: ['id', 'diag'],
  full: ['id', 'r90', 'r180', 'r270', 'mx', 'my', 'diag', 'anti'],
} as const satisfies Record<string, readonly (keyof typeof moves)[]>

export type Symmetry = keyof typeof symmetries

// How much of each shape goes into a generated block
export type ShapeMix = { tri: number; quarter: number; half: number; split: number; bars: number }
export const squaresOnly: ShapeMix = { tri: 0, quarter: 0, half: 0, split: 0, bars: 0 }

export type BlockSpec = {
  size: number // cells per side, 2–8 is the useful range
  symmetry: Symmetry
  roles: number // how many colour roles the block uses, including ground
  density: number // 0–1, share of cells that are not ground
  shapes: ShapeMix // relative weights; full squares always weigh 1
}

function randomShape(r: Rng, mix: ShapeMix): Shape {
  const kind = weighted(r, [['full', 1], ['tri', mix.tri], ['quarter', mix.quarter], ['half', mix.half], ['split', mix.split], ['bars', mix.bars]] as const)
  const corner = () => pick(r, ['nw', 'ne', 'se', 'sw'] as const)
  const side = () => pick(r, ['n', 'e', 's', 'w'] as const)
  switch (kind) {
    case 'full': return FULL
    case 'tri': return { kind, at: corner() }
    case 'quarter': return { kind, at: corner() }
    case 'half': return { kind, at: side() }
    case 'split': return { kind, at: side() }
    case 'bars': return { kind, dir: pick(r, ['h', 'v'] as const), count: pick(r, [2, 3, 4]) }
  }
}

function randomCell(r: Rng, spec: BlockSpec): Cell {
  const role = r() < spec.density ? int(r, 1, Math.max(1, spec.roles - 1)) : 0
  const shape = randomShape(r, spec.shapes)
  if (shape.kind === 'full') return { role, shape }
  let alt = int(r, 0, spec.roles - 1)
  if (alt === role) alt = (alt + 1) % spec.roles
  return { role, alt, shape }
}

export function generateBlock(r: Rng, spec: BlockSpec): Grid {
  // Turn-only symmetry with no mirror can make hooked crosses. Reroll those, then give up on turning.
  if (spec.symmetry === 'rotate') {
    for (let i = 0; i < 24; i++) {
      const g = fill(r, spec)
      if (!hooked(g)) return g
    }
    return fill(r, { ...spec, symmetry: 'full' })
  }
  return fill(r, spec)
}

function fill(r: Rng, spec: BlockSpec): Grid {
  const n = spec.size
  const group: Move[] = symmetries[spec.symmetry].map(k => moves[k])
  const grid: (Cell | undefined)[][] = Array.from({ length: n }, () => Array(n).fill(undefined))

  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (grid[y][x]) continue
      let c = randomCell(r, spec)
      // Where the symmetry maps a cell onto itself with a different shape (a triangle on the
      // diagonal of a fully symmetric block), the cell can't hold that shape, so fall back to a square.
      const orbit = group.map(g => ({ pos: g(x, y, n - 1), g }))
      const clash = orbit.some(({ pos: [px, py], g }) => px === x && py === y && !sameShape(moveCell(c, g).shape, c.shape))
        || orbit.some((a, i) => orbit.some((b, j) => j > i && a.pos[0] === b.pos[0] && a.pos[1] === b.pos[1]
          && !sameShape(moveCell(c, a.g).shape, moveCell(c, b.g).shape)))
      if (clash) c = { role: c.role, shape: FULL }
      for (const { pos: [px, py], g } of orbit) grid[py][px] = moveCell(c, g)
    }
  return grid as Grid
}

// Roles actually present, so a palette can be sized to the block
export const rolesIn = (g: Grid) => new Set(g.flat().flatMap(c => (c.alt === undefined ? [c.role] : [c.role, c.alt])))
