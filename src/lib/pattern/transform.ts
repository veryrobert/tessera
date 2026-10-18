import type { Cell, Corner, Shape, Side } from './types'

// The eight moves of a square (dihedral group D4) as coordinate maps on an n×n grid,
// x right, y down, m = n - 1. The same maps move corners and sides, using m = 1.
// A rectangle (mh = its height - 1) only keeps id, mx, my and r180.
export type Move = (x: number, y: number, m: number, mh?: number) => [number, number]
export const RECT_MOVES = ['id', 'mx', 'my', 'r180'] as const

export const moves = {
  id: (x, y) => [x, y],
  r90: (x, y, m) => [m - y, x],
  r180: (x, y, m, mh = m) => [m - x, mh - y],
  r270: (x, y, m) => [y, m - x],
  mx: (x, y, m) => [m - x, y],
  my: (x, y, m, mh = m) => [x, mh - y],
  diag: (x, y) => [y, x],
  anti: (x, y, m) => [m - y, m - x],
} satisfies Record<string, Move>

export type MoveName = keyof typeof moves

const corners: Record<Corner, [number, number]> = { nw: [0, 0], ne: [1, 0], se: [1, 1], sw: [0, 1] }
const sides: Record<Side, [number, number]> = { n: [0.5, 0], e: [1, 0.5], s: [0.5, 1], w: [0, 0.5] }
const find = <K extends string>(table: Record<K, [number, number]>, [x, y]: [number, number]) =>
  (Object.keys(table) as K[]).find(k => table[k][0] === x && table[k][1] === y)!

export function moveShape(shape: Shape, g: Move): Shape {
  switch (shape.kind) {
    case 'full':
      return shape
    case 'tri':
    case 'quarter':
      return { ...shape, at: find(corners, g(...corners[shape.at], 1)) }
    case 'half':
    case 'split':
      return { ...shape, at: find(sides, g(...sides[shape.at], 1)) }
    case 'bars': {
      const [ax, ay] = g(0, 0, 1)
      const [bx, by] = g(1, 0, 1)
      const turned = ax === bx && ay !== by
      return turned ? { ...shape, dir: shape.dir === 'h' ? 'v' : 'h' } : shape
    }
  }
}

export const moveCell = (c: Cell, g: Move): Cell => ({ ...c, shape: c.shape && moveShape(c.shape, g) })

// Square grids take any move; rectangles only the moves that keep their shape (RECT_MOVES)
export function moveGrid(grid: Cell[][], g: Move): Cell[][] {
  const h = grid.length, w = grid[0].length
  const out: Cell[][] = Array.from({ length: h }, () => Array<Cell>(w))
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [tx, ty] = g(x, y, w - 1, h - 1)
      out[ty][tx] = moveCell(grid[y][x], g)
    }
  return out
}

export const sameShape = (a?: Shape, b?: Shape) => JSON.stringify(a ?? { kind: 'full' }) === JSON.stringify(b ?? { kind: 'full' })
