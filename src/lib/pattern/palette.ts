import { type Rng, fork, pick, shuffle } from './random'

// Palettes are built in OKLCH, where equal steps of lightness look equal, so a
// "dark" role is equally dark whatever the hue. Each role has a lightness and
// chroma range; the scheme decides which hue family it takes.

export type Scheme = 'tonal' | 'complement' | 'split' | 'triad' | 'analogous' | 'scatter'
export type Ground = 'light' | 'dark' | 'colour'

export type PaletteSpec = {
  seed: number
  hue: number | null // 0–360, null picks one
  scheme: Scheme
  ground: Ground
  count: number // number of roles, 2–8
  preset?: PresetName // fixed colours instead of generated ones
}

// Fixed families: one hue in four steps, role order ground, figure, dark, mid, tint
export const presets = {
  berry: ['#fce9ff', '#c31351', '#580016', '#fa8ef1', '#fce9ff'],
  ultramarine: ['#ffffff', '#333dec', '#00006e', '#cdeeff', '#a3a9ff'],
  grass: ['#ffffff', '#00ab43', '#034005', '#b5f201', '#e3edd5'],
  petal: ['#ffe8ff', '#f88ef0', '#ffe8ff', '#f88ef0', '#ffe8ff'],
  tangerine: ['#fffbea', '#fffbea', '#eb5a17', '#eb5a17', '#eb5a17'],
  // From the other references
  willb: ['#ff5f1f', '#f3f1ec', '#050505', '#1f4fd8', '#ff5f1f'],
  plaid: ['#050505', '#1f4fd8', '#050505', '#ff5f1f', '#1f4fd8'],
  candy: ['#e8cfb4', '#3d9440', '#3a1c19', '#ff5530', '#ff3fa0', '#40c4e6'],
  hallen: ['#ffb5f2', '#ff3a3a', '#5c3e30', '#ff7a00', '#f24fd2'],
  forest: ['#dcdcd0', '#0b8a6a', '#5c4434', '#a3e0f8', '#0e6b3c'],
  poster: ['#ffffff', '#f7a9c4', '#9c7a62', '#183f88', '#c9d92e'],
  gingham: ['#e3edc4', '#2e8d4a', '#1b5c35', '#f4a6d6', '#d9c6a6'],
  carnival: ['#f8f8fb', '#e8322a', '#173f7e', '#f5a7d6', '#5a3a2a', '#c9d92e'],
  camo: ['#f7a8c0', '#183f88', '#9c7a62', '#ff6a1a', '#ffffff'],
  sunset: ['#f9e6a6', '#ff7a1a', '#e8322a', '#5a2e2a', '#f7a8c4', '#ffd21f'],
} as const satisfies Record<string, readonly string[]>

export type PresetName = keyof typeof presets

const offsets: Record<Exclude<Scheme, 'scatter'>, number[]> = {
  tonal: [0],
  complement: [0, 180],
  split: [0, 150, 210],
  triad: [0, 120, 240],
  analogous: [0, 35, -35],
}

// Role recipes in order: 0 ground, 1 figure, 2 dark, 3 accent, then extras.
// [lightness min, max], [chroma min, max], which hue family (index into offsets)
type Slot = { L: [number, number]; C: [number, number]; family: number }
const slots: Slot[] = [
  { L: [0.95, 0.98], C: [0.005, 0.03], family: 0 }, // ground
  { L: [0.55, 0.68], C: [0.17, 0.26], family: 0 }, // figure
  { L: [0.24, 0.34], C: [0.06, 0.12], family: 0 }, // dark
  { L: [0.62, 0.78], C: [0.14, 0.22], family: 1 }, // accent
  { L: [0.84, 0.9], C: [0.06, 0.1], family: 0 }, // tint
  { L: [0.45, 0.55], C: [0.12, 0.2], family: 2 }, // second accent
  { L: [0.7, 0.8], C: [0.1, 0.16], family: 2 },
  { L: [0.35, 0.45], C: [0.1, 0.16], family: 1 },
]

const lerp = (r: Rng, [a, b]: [number, number]) => a + r() * (b - a)

export function makePalette(spec: PaletteSpec): string[] {
  if (spec.preset) return [...presets[spec.preset]]
  const r = fork(spec.seed, 1)
  const base = spec.hue ?? r() * 360
  const families = spec.scheme === 'scatter'
    ? shuffle(r, [0, 45, 90, 150, 200, 250, 300]).map(h => h + r() * 20)
    : offsets[spec.scheme]

  return slots.slice(0, spec.count).map((s, i) => {
    let { L, C } = s
    if (i === 0 && spec.ground === 'dark') { L = [0.12, 0.18]; C = [0.005, 0.03] }
    if (i === 0 && spec.ground === 'colour') { L = [0.72, 0.86]; C = [0.12, 0.2] } // lighter than the figure, so they part
    if (i === 2 && spec.ground === 'dark') { L = [0.9, 0.96]; C = [0.01, 0.04] } // dark role becomes the light one
    // A coloured ground takes the second hue family, so even two colours contrast
    const fam = i === 0 && spec.ground === 'colour' ? 1 : s.family
    const family = families[fam % families.length] ?? 0
    const hue = (base + family + (r() - 0.5) * 14 + 360) % 360
    return oklch(lerp(r, L), lerp(r, C), hue)
  })
}

// Colourways: the same palette, roles reassigned. Ground stays put unless asked,
// which is how a quilt keeps one background while each block changes
export function colourways(seed: number, count: number, roles: number, keepGround = true): number[][] {
  const r = fork(seed, 2)
  const ids = Array.from({ length: roles }, (_, i) => i)
  const ways = [ids]
  for (let k = 1; k < count; k++) {
    ways.push(keepGround ? [0, ...shuffle(r, ids.slice(1))] : shuffle(r, ids))
  }
  return ways
}

export const randomHue = (r: Rng) => pick(r, [8, 25, 50, 95, 145, 200, 240, 280, 330]) + r() * 15

// ---------- OKLCH to hex, reducing chroma until it fits sRGB ----------

function toLinear(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const fits = (rgb: number[]) => rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4)
const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

export function oklch(L: number, C: number, h: number): string {
  let lo = 0, hi = C
  if (!fits(toLinear(L, C, h))) {
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (fits(toLinear(L, mid, h))) lo = mid
      else hi = mid
    }
    C = lo
  }
  return '#' + toLinear(L, C, h)
    .map(v => Math.round(Math.min(1, Math.max(0, gamma(v))) * 255).toString(16).padStart(2, '0'))
    .join('')
}
