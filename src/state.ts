import {
  type BlockSpec, type LayoutSpec, type LibraryName, type PaletteSpec, type PresetName, type Repeat, type Spec, type Symmetry,
  defaultSpec, library, presets, rng,
} from '@/lib/pattern'
import { int, pick } from '@/lib/pattern/random'

// Randomising, a part at a time. Shuffle changes the form and keeps the colour; Recolour the reverse.

export const newSeed = () => Math.floor(Math.random() * 2 ** 31)

export const LIBRARY = Object.keys(library) as LibraryName[]
export const PRESETS = Object.keys(presets) as PresetName[]

export const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'mirror', label: 'Mirror' },
  { value: 'twist', label: 'Twist' },
  { value: 'pinwheel', label: 'Pinwheel' },
  { value: 'half drop', label: 'Half drop' },
  { value: 'brick', label: 'Brick' },
  { value: 'step', label: 'Step' },
  { value: 'lattice', label: 'Lattice' },
]

export const SYMMETRIES: { value: Symmetry; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'mirror both', label: 'Mirror both' },
  { value: 'mirror', label: 'Mirror' },
  { value: 'rotate', label: 'Rotate' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'none', label: 'None' },
]

export function randomBlock(seed: number): BlockSpec {
  const r = rng(seed)
  const some = () => (r() < 0.5 ? 0 : Math.round(r() * 10) / 10)
  return {
    size: pick(r, [3, 4, 4, 5, 5, 6]),
    symmetry: pick(r, ['full', 'full', 'mirror both', 'rotate', 'diagonal', 'mirror'] as const),
    roles: int(r, 3, 5),
    density: 0.4 + Math.round(r() * 4) / 10,
    shapes: { tri: some(), quarter: some() * 0.6, half: some() * 0.6, split: some(), bars: some() * 0.5 },
  }
}

export function randomLayout(seed: number): LayoutSpec {
  const r = rng(seed)
  const n = int(r, 2, 5)
  const sash = r() < 0.3 ? 1 : 0
  return {
    cols: n, rows: r() < 0.7 ? n : n + 1,
    repeat: pick(r, REPEATS).value,
    invert: r() < 0.2,
    sashing: sash,
    sashRole: sash ? pick(r, [0, 2]) : 0,
    postRole: r() < 0.5 ? null : pick(r, [1, 2, 3]),
    colourways: pick(r, [1, 1, 2, 3]),
    cycle: pick(r, ['alternate', 'diagonal', 'random'] as const),
    seed,
  }
}

export function randomPalette(seed: number): PaletteSpec {
  const r = rng(seed)
  if (r() < 0.35) return { ...defaultSpec.palette, seed, preset: pick(r, PRESETS) }
  return {
    seed, hue: null, preset: undefined, count: 5,
    scheme: pick(r, ['tonal', 'tonal', 'complement', 'split', 'triad', 'analogous', 'scatter'] as const),
    ground: pick(r, ['light', 'light', 'dark', 'colour'] as const),
  }
}

// A new form, same colours
export function shuffle(s: Spec): Spec {
  const seed = newSeed(), r = rng(seed)
  const k = r()
  if (k < 0.12) {
    return { mode: 'field', seed, palette: s.palette, field: { kind: pick(r, ['camo', 'patches', 'streaks'] as const), cols: int(r, 8, 48), rows: int(r, 10, 60), scale: int(r, 3, 14) } }
  }
  if (k < 0.27) {
    return { mode: 'plaid', seed, palette: s.palette, plaid: { sett: null, mirror: r() < 0.6, weave: pick(r, ['plain', 'twill', 'over', 'under'] as const), cols: 48, rows: 48 } }
  }
  const generate = r() < 0.55
  return {
    mode: 'block', seed,
    source: generate ? 'generate' : pick(r, LIBRARY),
    block: generate ? randomBlock(seed) : s.mode === 'block' ? s.block : randomBlock(seed),
    layout: randomLayout(seed + 1),
    palette: s.palette,
    mask: s.mask,
  }
}

// Same form, new colours
// Recolouring a black and white pattern brings the colour in
export const recolour = (s: Spec): Spec => ({ ...s, palette: randomPalette(newSeed()), tone: (s.tone ?? 1) < 0.05 ? 1 : s.tone } as Spec)

// The block and layout settings to fall back on when switching from plaid
export const blockDefaults = defaultSpec as Extract<Spec, { mode: 'block' }>
