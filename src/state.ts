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
    ground: pick(r, ['light', 'light', 'light', 'colour', 'dark'] as const), // mostly a pale ground, as on a quilt
  }
}

// A new form, same colours
// Quilts, after Waybill's swatches and the scrap quilt: a structural block repeated on a grid, with
// or without sashing and posts, each block in its own random colours or one palette for all.
export const QUILT: LibraryName[] = [
  'corner', 'corner wide', 'square in square', 'framed square', 'antique tile', 'courthouse steps',
  'log cabin', 'nine patch', 'double nine patch', 'capped check', 'checker', 'four patch', 'churn dash',
  'roman square', 'basket weave', 'rail fence',
] // sixteen, a full four by four in the picker

export const blockWidth = (s: Extract<Spec, { mode: 'block' }>) => (s.source === 'generate' ? s.block.size : library[s.source][0].length)
// Frame width for a number of blocks across, so the frame ends on whole blocks
export const acrossToScale = (s: Extract<Spec, { mode: 'block' }>, n: number) => n * (blockWidth(s) + s.layout.sashing) + s.layout.sashing
export const scaleToAcross = (s: Extract<Spec, { mode: 'block' }>) =>
  Math.max(1, Math.round(((s.scale ?? acrossToScale(s, s.layout.cols)) - s.layout.sashing) / (blockWidth(s) + s.layout.sashing)))

export function quilt(seed: number, palette: PaletteSpec, keep: { aspect?: number; tone?: number; mask?: Spec['mask'] } = {}): Spec {
  const r = rng(seed)
  const source = pick(r, QUILT)
  const across = pick(r, [1, 2, 2, 3, 3, 4, 5])
  const sashing = 0 // no gap by default, so the frame's corners start on whole blocks; Gap adds one
  const s: Extract<Spec, { mode: 'block' }> = {
    mode: 'block', seed, source, block: randomBlock(seed), palette, ...keep, aspect: keep.aspect ?? 1,
    layout: {
      cols: across, rows: across, repeat: across === 1 ? 'grid' : pick(r, ['grid', 'grid', 'mirror', 'twist', 'twist', 'pinwheel']),
      invert: false, sashing, sashRole: 0, postRole: null,
      colourways: 1, cycle: 'random', seed, palettes: pick(r, [1, 1, 4, 8, 12]),
    },
  }
  return { ...s, scale: acrossToScale(s, across) }
}

export const shuffle = (s: Spec): Spec => ({ ...quilt(newSeed(), s.palette, { aspect: s.aspect, tone: s.tone, mask: s.mask }), spaces: s.spaces })

// Same form, new colours
// Recolouring a black and white pattern brings the colour in
export const recolour = (s: Spec): Spec => ({ ...s, palette: randomPalette(newSeed()), tone: (s.tone ?? 1) < 0.05 ? 1 : s.tone } as Spec)

// The block and layout settings to fall back on when switching from plaid
export const blockDefaults = defaultSpec as Extract<Spec, { mode: 'block' }>
