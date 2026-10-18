import { type BlockSpec, type LibraryName, generateBlock, library } from './blocks'
import { type LayoutSpec, tile } from './layout'
import { type PaletteSpec, makePalette, presets } from './palette'
import { type PlaidSpec, plaid, randomSett } from './plaid'
import { type FieldSpec, field } from './field'
import { type ComposeSpec, type Item, compose } from './compose'
import { fork } from './random'
import type { Grid } from './types'

export * from './types'
export * from './blocks'
export * from './palette'
export * from './plaid'
export * from './layout'
export * from './field'
export * from './compose'
export { hooked } from './guard'
export { rng, fork } from './random'

// The whole state of a pattern. Serialisable, so it can sit in the URL.
// mask cuts the pattern to a shape (the WillB circle), with role filling the rest.
export type Mask = { shape: 'none' | 'circle' | 'arch' | 'diamond'; role: number; inset: number }
// tone: 0 is black and white (greys ranked by lightness), 1 full colour, in between a blend
// scale: cells across a fixed frame (aspect is its height over width). Set, the pattern repeats to
// fill the frame and scale zooms it smoothly; unset, the frame fits the layout's tiles.
// offset: how far the pattern is slid under the frame, in cells
type Common = { seed: number; palette: PaletteSpec; mask?: Mask; tone?: number; scale?: number; aspect?: number; offset?: [number, number] }
export type Spec = Common & (
  | { mode: 'block'; source: LibraryName | 'generate'; block: BlockSpec; layout: LayoutSpec }
  | { mode: 'plaid'; plaid: Omit<PlaidSpec, 'sett'> & { sett: PlaidSpec['sett'] | null } }
  | { mode: 'field'; field: FieldSpec }
  | { mode: 'compose'; compose: ComposeSpec }
)

export type Pattern = { grid: Grid; colours: string[]; mask?: Mask; items?: Item[]; view?: { x: number; y: number; w: number; h: number } }

export function build(spec: Spec): Pattern {
  const p = framed(spec)
  const used = new Set(p.grid.flat().flatMap(c => (c.alt === undefined ? [c.role] : [c.role, c.alt])))
  for (const it of p.items ?? []) { used.add(it.role); if (it.stripes) used.add(it.stripes.alt) }
  if (p.mask) used.add(p.mask.role)
  return { ...p, colours: toned(p.colours, spec.tone ?? 1, used) }
}

// With a scale, grow the pattern past the frame and crop to it, centred
function framed(spec: Spec): Pattern {
  if (!spec.scale) return buildColour(spec)
  const w = spec.scale, h = spec.scale * (spec.aspect ?? 1)
  const W = Math.ceil(w) + 1, H = Math.ceil(h) + 1
  let s: Spec
  if (spec.mode === 'block') {
    const bw = spec.source === 'generate' ? spec.block.size : library[spec.source][0].length
    const bh = spec.source === 'generate' ? spec.block.rows ?? spec.block.size : library[spec.source].length
    const sash = spec.layout.sashing
    // A frame that ends on whole blocks shows exactly those blocks; otherwise grow past it and centre
    const fit = (w - sash) / (bw + sash)
    if (Number.isInteger(fit) && fit > 0) {
      // Down locks to whole blocks too: the frame's height rounds to the nearest whole row
      const rowsFit = Math.max(1, Math.round((h - sash) / (bh + sash)))
      // Two spare tiles each side, so the pattern can slide under the frame; the slide wraps every
      // two tiles (a mirrored repeat's period), so the frame never runs off the edge
      const M = 2, pw = bw + sash, ph = bh + sash
      const wrap = (v: number, p: number) => ((((v % (2 * p)) + 3 * p) % (2 * p)) - p)
      const [ox, oy] = spec.offset ?? [0, 0]
      const p = buildColour({ ...spec, layout: { ...spec.layout, cols: fit + 2 * M, rows: rowsFit + 2 * M } })
      return { ...p, view: { x: M * pw - wrap(ox, pw), y: M * ph - wrap(oy, ph), w, h: rowsFit * ph + sash } }
    }
    s = { ...spec, layout: { ...spec.layout, cols: Math.ceil(W / (bw + sash)) + 1, rows: Math.ceil(H / (bh + sash)) + 1 } }
  } else if (spec.mode === 'plaid') s = { ...spec, plaid: { ...spec.plaid, cols: W, rows: H } }
  else if (spec.mode === 'compose') s = { ...spec, compose: { ...spec.compose, cols: W, rows: H } }
  else s = { ...spec, field: { ...spec.field, cols: W, rows: H } }
  const p = buildColour(s)
  const gw = p.grid[0].length, gh = p.grid.length
  return { ...p, view: { x: Math.max(0, (gw - w) / 2), y: Math.max(0, (gh - h) / 2), w, h } }
}

function buildColour(spec: Spec): Pattern {
  const colours = makePalette(spec.palette)
  const mask = spec.mask?.shape && spec.mask.shape !== 'none' ? spec.mask : undefined
  if (spec.mode === 'plaid') {
    const sett = spec.plaid.sett ?? randomSett(fork(spec.seed, 4), colours.length)
    return { grid: plaid({ ...spec.plaid, sett }), colours, mask }
  }
  if (spec.mode === 'field') return { grid: field(spec.seed, spec.field, colours.length), colours, mask }
  if (spec.mode === 'compose') {
    const { cols, rows } = spec.compose
    const grid: Grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ role: 0 })))
    return { grid, colours, mask, items: compose(spec.seed, spec.compose, colours.length) }
  }
  const block = spec.source === 'generate' ? generateBlock(fork(spec.seed, 5), spec.block) : library[spec.source]
  // Mixed sets: each tile takes one of the chosen sets whole, ground and all
  const sets = spec.palette.mix ?? []
  if (sets.length > 1) {
    const all: string[] = [], ways: number[][] = []
    for (const name of sets) {
      const set = presets[name], at = all.length
      all.push(...set)
      ways.push(Array.from({ length: Math.max(...sets.map(n => presets[n].length)) }, (_, role) => at + (role % set.length)))
    }
    return { grid: tile(block, { ...spec.layout, cycle: 'random' }, ways[0].length, ways), colours: all, mask }
  }
  // Mixed random: each tile takes its own palette (same scheme, new hues), ground shared, as in a scrap quilt
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

// Colours toward black and white: each becomes a grey by its rank in lightness, the ground white,
// darkest off-black, the rest evenly between, so a two-colour pattern is pure black and white
function toned(colours: string[], tone: number, used: Set<number>): string[] {
  if (tone >= 1) return colours
  const rgb = colours.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)))
  const lum = rgb.map(([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b)
  // The ground (role 0) is always white, whatever its colour; the rest take the greys below it by lightness
  lum[0] = 256
  const levels = [...new Set(lum.filter((_, i) => used.has(i)).map(l => Math.round(l)))].sort((a, b) => b - a)
  return rgb.map((c, i) => {
    const k = Math.max(0, levels.findIndex(l => l <= Math.round(lum[i])))
    const INK = 20 // the darkest is a slight off-black (#141414), so it parts from a black page
    const grey = levels.length < 2 ? 255 : Math.round(255 - (255 - INK) * (k / (levels.length - 1)))
    return '#' + c.map(v => Math.round(grey + (v - grey) * tone).toString(16).padStart(2, '0')).join('')
  })
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
