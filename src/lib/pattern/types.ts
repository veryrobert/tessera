// A pattern is a grid of cells. Each cell holds colour roles, not colours:
// role 0 is ground, 1 figure, 2 dark, 3 accent and so on. The palette decides
// what each role looks like, so form and colour change independently.

export type Corner = 'nw' | 'ne' | 'se' | 'sw'
export type Side = 'n' | 'e' | 's' | 'w'

export type Shape =
  | { kind: 'full' }
  | { kind: 'tri'; at: Corner } // half-square triangle filling that corner
  | { kind: 'quarter'; at: Corner } // quarter disc centred on that corner
  | { kind: 'half'; at: Side } // half disc whose diameter is that side
  | { kind: 'split'; at: Side } // half rectangle against that side
  | { kind: 'bars'; dir: 'h' | 'v'; count: number } // stripes, role and alt alternating

// role fills the shape, alt fills the rest of the cell
export type Cell = { role: number; alt?: number; shape?: Shape }
export type Grid = Cell[][] // [row][col]

export const FULL: Shape = { kind: 'full' }
export const cell = (role: number, shape: Shape = FULL, alt?: number): Cell => ({ role, shape, alt })
