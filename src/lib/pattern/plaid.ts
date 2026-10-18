import { type Rng, int, weighted } from './random'
import { type Grid, FULL } from './types'

// Plaid, gingham and tartan come from one stripe sequence (the sett) run both ways.
// Each cell sits where a vertical stripe (warp) crosses a horizontal one (weft);
// the weave decides which of the two shows.

export type Stripe = { role: number; width: number }
export type Weave = 'plain' | 'twill' | 'over' | 'under'

export type PlaidSpec = {
  sett: Stripe[]
  weft?: Stripe[] // a different sequence across; defaults to the sett
  mirror: boolean // tartans reflect at each end of the sett
  weave: Weave
  cols: number
  rows: number
}

const expand = (sett: Stripe[], mirror: boolean) => {
  const run = sett.flatMap(s => Array<number>(s.width).fill(s.role))
  return mirror ? [...run, ...run.slice(1, -1).reverse()] : run
}

export function plaid(spec: PlaidSpec): Grid {
  const warp = expand(spec.sett, spec.mirror)
  const weft = expand(spec.weft ?? spec.sett, spec.mirror)
  return Array.from({ length: spec.rows }, (_, y) =>
    Array.from({ length: spec.cols }, (_, x) => {
      const a = warp[x % warp.length]
      const b = weft[y % weft.length]
      let role: number
      if (a === b) role = a
      else switch (spec.weave) {
        case 'plain': role = (x + y) % 2 ? a : b; break // fine check where stripes cross
        case 'twill': role = (x + y) % 4 < 2 ? a : b; break // 2/2 twill, the stepped diagonal
        case 'over': role = Math.max(a, b); break // higher role always on top, flat graphic plaid
        case 'under': role = Math.min(a, b); break
      }
      return { role, shape: FULL }
    }),
  )
}

export function randomSett(r: Rng, roles: number): Stripe[] {
  const n = int(r, 3, 7)
  const out: Stripe[] = []
  for (let i = 0; i < n; i++) {
    let role = int(r, 0, roles - 1)
    if (out.length && out[out.length - 1].role === role) role = (role + 1) % roles
    out.push({ role, width: weighted(r, [[1, 2], [2, 3], [4, 3], [8, 2], [16, 1]] as const) })
  }
  return out
}
