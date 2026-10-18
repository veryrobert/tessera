import { type LayoutSpec, type LibraryName, type PaletteSpec, type PresetName, type Spec, defaultSpec, examples } from '@/lib/pattern'

// Starting points, one or more per reference: Waybill's swatches, the WillB card, the pixel
// posters, the Duluth wrappers, the Amsterdam signs and the scrap quilt.

const palette = (preset: PresetName): PaletteSpec => ({ ...defaultSpec.palette, preset, count: 5 })
const generated = (p: Partial<PaletteSpec>): PaletteSpec => ({ seed: 7, hue: null, scheme: 'scatter', ground: 'light', count: 5, preset: undefined, ...p })
const layout = (p: Partial<LayoutSpec>): LayoutSpec => ({ cols: 4, rows: 4, repeat: 'grid', invert: false, sashing: 0, sashRole: 0, postRole: null, colourways: 1, cycle: 'alternate', seed: 1, ...p })
const block = (source: LibraryName, preset: PresetName | PaletteSpec, l: Partial<LayoutSpec>, seed = 1): Spec => ({
  mode: 'block', seed, source, block: (defaultSpec as Extract<Spec, { mode: 'block' }>).block,
  layout: layout(l), palette: typeof preset === 'string' ? palette(preset) : preset,
})

export const looks: { name: string; spec: Spec }[] = [
  { name: 'Corner', spec: examples.corner },
  { name: 'Frame', spec: examples.frame },
  { name: 'Twist', spec: examples.twist },
  { name: 'Capped', spec: examples.capped },
  { name: 'Lattice', spec: examples.lattice },
  { name: 'Weave', spec: examples.weave },
  {
    name: 'Check circle',
    spec: { mode: 'plaid', seed: 3, palette: palette('willb'), mask: { shape: 'circle', role: 0, inset: 0.12 },
      plaid: { sett: [{ role: 0, width: 1 }, { role: 1, width: 1 }], mirror: false, weave: 'twill', cols: 32, rows: 32 } },
  },
  {
    name: 'Card plaid',
    spec: { mode: 'plaid', seed: 4, palette: palette('plaid'),
      plaid: { sett: [{ role: 1, width: 10 }, { role: 0, width: 2 }, { role: 1, width: 1 }, { role: 0, width: 1 }, { role: 1, width: 1 }, { role: 0, width: 14 }], mirror: false, weave: 'over', cols: 58, rows: 72 } },
  },
  { name: 'Scrap quilt', spec: block('square in square', generated({ scheme: 'scatter', seed: 21 }), { cols: 5, rows: 5, sashing: 1, sashRole: 0, postRole: 2, palettes: 6, cycle: 'random', seed: 5 }) },
  { name: 'Camo', spec: { mode: 'field', seed: 8, palette: palette('camo'), field: { kind: 'camo', cols: 40, rows: 50, scale: 12 } } },
  { name: 'Patches', spec: { mode: 'field', seed: 9, palette: { ...palette('sunset'), count: 6 }, field: { kind: 'patches', cols: 8, rows: 11, scale: 1 } } },
  { name: 'Streaks', spec: { mode: 'field', seed: 10, palette: { ...palette('carnival'), count: 6 }, field: { kind: 'streaks', cols: 40, rows: 54, scale: 5 } } },
  {
    name: 'Gingham',
    spec: { mode: 'plaid', seed: 11, palette: palette('gingham'),
      plaid: { sett: [{ role: 2, width: 6 }, { role: 0, width: 4 }, { role: 1, width: 4 }, { role: 3, width: 4 }], mirror: true, weave: 'plain', cols: 56, rows: 70 } },
  },
  { name: 'Carnival', spec: block('checker', { ...palette('carnival'), count: 6 }, { cols: 3, rows: 4, colourways: 4, cycle: 'random', seed: 12 }) },
  { name: 'Signs', spec: block('sign', 'hallen', { cols: 1, rows: 2, repeat: 'mirror' }) },
  { name: 'Diagonals', spec: block('diagonals', 'forest', { cols: 2, rows: 3, repeat: 'mirror' }) },
  { name: 'Domes', spec: block('domes', 'hallen', { cols: 3, rows: 3, repeat: 'grid', colourways: 2 }) },
  { name: 'Bricks', spec: { mode: 'compose', seed: 31, palette: { ...palette('candy'), count: 6 }, scale: 9, aspect: 1.6, compose: { style: 'bricks', cols: 9, rows: 15, size: 2 } } },
  { name: 'Strips', spec: { mode: 'compose', seed: 32, palette: { ...palette('candy'), count: 6 }, scale: 12, aspect: 1.6, compose: { style: 'strips', cols: 12, rows: 20, size: 1 } } },
  { name: 'Striped', spec: { mode: 'compose', seed: 33, palette: { ...palette('candy'), count: 6 }, scale: 12, aspect: 1.6, compose: { style: 'stripes', cols: 12, rows: 20, size: 3 } } },
  { name: 'Wrapper', spec: block('stripe blocks', { ...palette('candy'), count: 6 }, { cols: 3, rows: 6, repeat: 'brick', colourways: 3, cycle: 'random', seed: 14 }) },
  { name: 'Log cabin', spec: block('log cabin', { ...palette('candy'), count: 6 }, { cols: 2, rows: 3, colourways: 3, cycle: 'diagonal', seed: 15 }) },
  { name: 'Steps', spec: block('log steps', { ...palette('candy'), count: 6 }, { cols: 3, rows: 4, repeat: 'twist', colourways: 2, seed: 16 }) },
  { name: 'Balls', spec: block('stripe balls', { ...palette('candy'), count: 6 }, { cols: 3, rows: 4, colourways: 4, cycle: 'random', seed: 17 }) },
]
