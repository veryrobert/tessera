import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Single choice laid out as a grid, for when there are too many options for one Segmented row.
// Looks like Segmented: muted track, the chosen option inverted.
export function Choices<T extends string | number>({
  value,
  onChange,
  options,
  label,
  cols = 3,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
  cols?: number
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-0.5 rounded-[10px] bg-muted p-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 min-w-0 truncate rounded-lg px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
            o.value === value ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background/40',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// A grid of picture tiles (patterns, palettes), the chosen one ringed
export function Tiles({ label, cols = 4, children }: { label: string; cols?: number; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {children}
    </div>
  )
}

export function Tile({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'grid aspect-square place-items-center overflow-hidden rounded-md border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'outline-2 outline-offset-2 outline-foreground',
      )}
    >
      {children}
    </button>
  )
}
