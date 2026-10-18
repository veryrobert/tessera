import { type BlockSpec, type LibraryName, generateBlock, library } from './blocks'
import { type LayoutSpec, tile } from './layout'
import { type PaletteSpec, makePalette } from './palette'
import { type PlaidSpec, plaid, randomSett } from './plaid'
import { type FieldSpec, field } from './field'
import { fork } from './random'
import type { Grid } from './types'

export * from './types'
export * from './blocks'
export * from './palette'
export * from './plaid'
export * from './layout'
export * from './field'
export { hooked } from './guard'
export { rng, fork } from './random'

// The whole state of a pattern. Serialisable, so it can sit in the URL.
// mask cuts the pattern to a shape (the WillB circle), with role filling the rest.
export type Mask = { shape: 'none' | 'circle' | 'arch' | 'diamond'; role: number; inset: number }
type Common = { seed: number; palette: PaletteSpec; mask?: Mask }
export type Spec = Common & (
  | { mode: 'block'; source: LibraryName | 'generate'; block: BlockSpec; layout: LayoutSpec }
  | { mode: 'plaid'; plaid: Omit<PlaidSpec, 'sett'> & { sett: PlaidSpec['sett'] | null } }
  | { mode: 'field'; field: FieldSpec }
)

export type Pattern = { grid: Grid; colours: string[]; mask?: Mask }

export function build(spec: Spec): Pattern {
  const colours = makePalette(spec.palette)
  const mask = spec.mask?.shape && spec.mask.shape !== 'none' ? spec.mask : undefined
  if (spec.mode === 'plaid') {
    const sett = spec.plaid.sett ?? randomSett(fork(spec.seed, 4), colours.length)
    return { grid: plaid({ ...spec.plaid, sett }), colours, mask }
  }
  if (spec.mode === 'field') return { grid: field(spec.seed, spec.field, colours.length), colours, mask }
  const block = spec.source === 'generate' ? generateBlock(fork(spec.seed, 5), spec.block) : library[spec.source]
  // Mixed: each tile takes its own palette (same scheme, new hues), ground shared, as in a scrap quilt
  const mix = spec.layout.palettes ?? 1
  if (mix > 1) {
    const n = colours.length
    const all = [...colours]
    const r = fork(spec.palette.seed, 9)
    for (let k = 1; k < mix; k++) all.push(...makePalette({ ...spec.palette, preset: undefined, count: n, hue: Math.floor(r() * 360), seed: Math.floor(r() * 2 ** 31) }))
    const ways = Array.from({ length: mix }, (_, k) => Array.from({ length: n }, (_, role) => (role === 0 ? 0 : role + k * n)))
    return { grid: tile(block, spec.layout, n, ways), colours: all, mask }
  }
  return { grid: tile(block, spec.layout, colours.length), colours, mask }
}

// Share and restore through location.hash
export const encode = (spec: Spec) => btoa(JSON.stringify(spec)).replace(/=+$/, '')
export const decode = (hash: string): Spec | null => {
  try { return JSON.parse(atob(hash.replace(/^#/, ''))) } catch { return null }
}

export const defaultSpec: Spec = {
  mode: 'block',
  seed: 1,
  source: 'corner',
  block: { size: 5, symmetry: 'full', roles: 5, density: 0.6, shapes: { tri: 0.4, quarter: 0, half: 0, split: 0.2, bars: 0 } },
  layout: { cols: 4, rows: 4, repeat: 'twist', invert: false, sashing: 0, sashRole: 0, postRole: null, colourways: 1, cycle: 'alternate', seed: 1 },
  palette: { seed: 1, hue: null, scheme: 'tonal', ground: 'light', count: 5, preset: 'berry' },
}

// The six reference swatches, as specs
const ref = (source: LibraryName, preset: NonNullable<PaletteSpec['preset']>, layout: Partial<LayoutSpec>): Spec => ({
  ...defaultSpec, mode: 'block', source,
  layout: { cols: 2, rows: 2, repeat: 'grid', invert: false, sashing: 0, sashRole: 0, postRole: null, colourways: 1, cycle: 'alternate', seed: 1, ...layout },
  palette: { seed: 1, hue: null, scheme: 'tonal', ground: 'light', count: 5, preset },
} as Spec)

export const examples = {
  corner: ref('corner', 'berry', { cols: 1, rows: 1 }),
  frame: ref('corner', 'ultramarine', { repeat: 'mirror' }),
  twist: ref('corner', 'grass', { repeat: 'twist' }),
  capped: ref('capped check', 'petal', { cols: 3, rows: 3 }),
  lattice: ref('plain', 'tangerine', { cols: 5, rows: 5, sashing: 1, sashRole: 2, postRole: 0 }),
  weave: ref('corner', 'berry', { cols: 4, rows: 4, repeat: 'twist' }),
} satisfies Record<string, Spec>
