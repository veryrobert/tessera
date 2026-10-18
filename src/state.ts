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

// One idea per block, as in the references: plain squares, or triangles and halves, or curves,
// or stripes. Never all at once, and two to four colours.
export function randomBlock(seed: number): BlockSpec {
  const r = rng(seed)
  const amount = 0.5 + r() * 0.7
  const none = { tri: 0, quarter: 0, half: 0, split: 0, bars: 0 }
  const style = r()
  const shapes = style < 0.35 ? none
    : style < 0.65 ? { ...none, tri: amount, split: amount * 0.5 }
    : style < 0.85 ? { ...none, quarter: amount * 0.7, half: amount * 0.7 }
    : { ...none, bars: amount, split: amount * 0.3 }
  return {
    size: pick(r, [3, 4, 4, 5, 5, 6]),
    symmetry: pick(r, ['full', 'full', 'mirror both', 'rotate', 'diagonal', 'mirror'] as const),
    roles: pick(r, [2, 2, 3]), // few tones by default; Depth adds more
    density: 0.35 + Math.round(r() * 3) / 10,
    shapes,
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
  // Only sets whose ground and figure differ, or a two-colour pattern comes out flat
  const contrasting = PRESETS.filter(p => presets[p][0] !== presets[p][1])
  if (r() < 0.35) { const preset = pick(r, contrasting); return { ...defaultSpec.palette, seed, preset, count: presets[preset].length } }
  return {
    seed, hue: null, preset: undefined, count: 5,
    // Mostly contrasting hues, as in the references; tonal only now and then
    scheme: pick(r, ['complement', 'complement', 'split', 'split', 'triad', 'triad', 'scatter', 'scatter', 'scatter', 'analogous', 'tonal'] as const),
    ground: pick(r, ['light', 'dark', 'colour', 'colour'] as const),
  }
}

// A new form, same colours
// Big by default, as in the references: one to three blocks across the frame. Keeps the frame,
// the colour amount, the cut and the palette.
const blocksAcross = (r: () => number) => pick(r, [1, 1.5, 2, 2, 2.5, 3])

export function shuffle(s: Spec): Spec {
  const seed = newSeed(), r = rng(seed)
  const keep = { palette: s.palette, mask: s.mask, tone: s.tone, aspect: s.aspect ?? 1 }
  const k = r()
  if (k < 0.12) {
    return { mode: 'field', seed, ...keep, scale: int(r, 12, 36), field: { kind: pick(r, ['camo', 'patches', 'streaks'] as const), cols: 40, rows: 40, scale: int(r, 3, 10) } }
  }
  if (k < 0.27) {
    return { mode: 'plaid', seed, ...keep, scale: int(r, 16, 44), plaid: { sett: null, mirror: r() < 0.6, weave: pick(r, ['plain', 'twill', 'over', 'under'] as const), cols: 48, rows: 48 } }
  }
  const generate = r() < 0.55
  const source = generate ? 'generate' : pick(r, LIBRARY)
  const block = generate ? randomBlock(seed) : s.mode === 'block' ? s.block : randomBlock(seed)
  const layout = randomLayout(seed + 1)
  const width = (source === 'generate' ? block.size : library[source][0].length) + layout.sashing
  return { mode: 'block', seed, ...keep, source, block, layout, scale: width * blocksAcross(r) + layout.sashing }
}

// Same form, new colours
// Recolouring a black and white pattern brings the colour in
export const recolour = (s: Spec): Spec => ({ ...s, palette: randomPalette(newSeed()), tone: (s.tone ?? 1) < 0.05 ? 1 : s.tone } as Spec)

// The block and layout settings to fall back on when switching from plaid
export const blockDefaults = defaultSpec as Extract<Spec, { mode: 'block' }>
