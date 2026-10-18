// Seeded randomness, so a pattern is reproducible from a number
export type Rng = () => number

export function rng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A second stream from the same seed, so one layer can change without moving the others
export const fork = (seed: number, salt: number) => rng((seed ^ Math.imul(salt, 0x9e3779b9)) >>> 0)

export const int = (r: Rng, min: number, max: number) => min + Math.floor(r() * (max - min + 1))
export const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]

export function weighted<T>(r: Rng, xs: readonly (readonly [T, number])[]): T {
  const total = xs.reduce((s, [, w]) => s + w, 0)
  let n = r() * total
  for (const [x, w] of xs) if ((n -= w) < 0) return x
  return xs[xs.length - 1][0]
}

export function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
