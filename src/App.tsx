import { useEffect, useMemo, useRef, useState } from 'react'
import { Ban, Download, SlidersHorizontal, Grid2x2, LayoutGrid, LayoutTemplate, Link, Palette, Shuffle, Sparkles, Undo2, Wand2 } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ToolButton } from '@/components/shell/ToolButton'
import { Toolbar, ToolbarSeparator } from '@/components/shell/Toolbar'
import { OnOff, Segmented } from '@/components/shell/Segmented'
import { Field, FieldGroup } from '@/components/shell/Field'
import { Splash } from '@/components/shell/Splash'
import { PanelRail } from '@/components/shell/PanelRail'
import { PanelSheet } from '@/components/shell/PanelSheet'
import { ActionDock } from '@/components/shell/ActionDock'
import { PANEL_W, PHONE_SHEET, SAFE_BOTTOM, usePhone } from '@/components/shell/layout'
import { Choices, Tile, Tiles } from '@/components/Choices'
import { PatternSvg, svgString } from '@/components/pattern/PatternSvg'
import {
  type Cycle, type FieldKind, type Ground, type LayoutSpec, type Mask, type PaletteSpec, type Scheme, type ShapeMix, type Spec,
  build, decode, defaultSpec, encode, makePalette, presets, rng,
} from '@/lib/pattern'
import { LIBRARY, PRESETS, REPEATS, SYMMETRIES, blockDefaults, newSeed, randomBlock, randomPalette, recolour, shuffle } from '@/state'
import { cn } from '@/lib/utils'
import { looks } from '@/looks'

// kaleidoscope: quilt blocks, repeats and plaids from a seed. The whole pattern lives in the URL,
// so any look can be shared or bookmarked.

const panels = [
  { id: 'build', label: 'Build', icon: SlidersHorizontal },
  { id: 'looks', label: 'Looks', icon: LayoutTemplate },
  { id: 'pattern', label: 'Pattern', icon: Grid2x2 },
  { id: 'layout', label: 'Layout', icon: LayoutGrid },
  { id: 'colour', label: 'Colour', icon: Palette },
  { id: 'export', label: 'Export', icon: Download },
] as const
type PanelId = (typeof panels)[number]['id']

type BlockMode = Extract<Spec, { mode: 'block' }>
type PlaidMode = Extract<Spec, { mode: 'plaid' }>
type FieldMode = Extract<Spec, { mode: 'field' }>

// Opens in black and white on a plain generated block; the Build sliders add from there
const startSpec: Spec = {
  ...(defaultSpec as Extract<Spec, { mode: 'block' }>),
  source: 'generate', seed: 3, tone: 0, scale: 20, aspect: 1,
  block: { size: 5, symmetry: 'full', roles: 2, density: 0.4, shapes: { tri: 0.3, quarter: 0.12, half: 0.12, split: 0.18, bars: 0.09 } },
  layout: { ...defaultSpec.mode === 'block' ? defaultSpec.layout : ({} as LayoutSpec), cols: 4, rows: 4, repeat: 'mirror' },
  palette: { seed: 3, hue: null, scheme: 'complement', ground: 'light', count: 5, preset: undefined },
}
// A fresh random block each time the app opens without a link: black and white, two or three tones,
// sometimes a rectangle, at a random scale, with colours waiting behind the Colour slider
function randomStart(): Spec {
  const seed = newSeed(), r = rng(seed)
  const blk = randomBlock(seed)
  const sb = startSpec as BlockMode
  return {
    ...sb, seed, tone: 0, scale: blk.size * [1, 1.5, 2, 2, 2.5, 3][Math.floor(r() * 6)], aspect: 1, // one to three blocks across
    block: { ...blk, roles: 2 + Math.floor(r() * 2), density: 0.3 + r() * 0.3, rows: r() < 0.3 ? 1 + Math.floor(r() * 8) : undefined },
    layout: { ...sb.layout, repeat: (['mirror', 'mirror', 'twist', 'grid', 'brick', 'half drop'] as const)[Math.floor(r() * 6)] },
    palette: randomPalette(seed),
  }
}
const fromHash = () => (location.hash.length > 1 ? decode(location.hash) : null) ?? randomStart()
const SHAPE_LABELS = { tri: 'Triangles', split: 'Halves', quarter: 'Quarter circles', half: 'Half circles', bars: 'Stripes' } as const

export default function App() {
  const phone = usePhone()
  const [panel, setPanel] = useState<PanelId | null>(() => (matchMedia('(max-width: 639px)').matches ? null : 'build'))
  const [spec, setSpecRaw] = useState<Spec>(fromHash)
  const past = useRef<Spec[]>([])
  const [note, setNote] = useState('')
  const stage = useRef<HTMLElement>(null)
  const current = panels.find(p => p.id === panel)

  const pattern = useMemo(() => build(spec), [spec])

  // Every change goes through here, so it can be undone and lands in the URL
  const setSpec = (next: Spec | ((s: Spec) => Spec)) => setSpecRaw(s => {
    const n = typeof next === 'function' ? next(s) : next
    if (n !== s) past.current = [...past.current.slice(-60), s]
    return n
  })
  const undo = () => {
    const prev = past.current.pop()
    if (prev) setSpecRaw(prev)
  }

  useEffect(() => { history.replaceState(null, '', '#' + encode(spec)) }, [spec])
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(''), 1800)
    return () => clearTimeout(t)
  }, [note])

  // Keys: space shuffles, c recolours, cmd/ctrl+z undoes
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [role=slider]')) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo() }
      else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); setSpec(shuffle) }
      else if (e.key === 'c' && !e.metaKey && !e.ctrlKey) setSpec(recolour)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Part updates
  const asBlock = (s: Spec): BlockMode => (s.mode === 'block' ? s : { ...blockDefaults, seed: s.seed, palette: s.palette })
  const setLayout = (p: Partial<LayoutSpec>) => setSpec(s => { const b = asBlock(s); return { ...b, layout: { ...b.layout, ...p } } })
  const setBlock = (p: Partial<BlockMode['block']>) => setSpec(s => { const b = asBlock(s); return { ...b, source: 'generate', block: { ...b.block, ...p } } })
  const setShapes = (p: Partial<ShapeMix>) => setSpec(s => { const b = asBlock(s); return { ...b, source: 'generate', block: { ...b.block, shapes: { ...b.block.shapes, ...p } } } })
  const setPlaid = (p: Partial<PlaidMode['plaid']>) => setSpec(s => (s.mode === 'plaid' ? { ...s, plaid: { ...s.plaid, ...p } } : s))
  // Choosing colours brings colour in when the pattern is still black and white
  const coloured = (s: Spec): Spec => ((s.tone ?? 1) < 0.05 ? { ...s, tone: 1 } : s)
  const setPalette = (p: Partial<PaletteSpec>) => setSpec(s => coloured({ ...s, palette: { ...s.palette, ...p } } as Spec))
  const setField = (p: Partial<FieldMode['field']>) => setSpec(s => (s.mode === 'field' ? { ...s, field: { ...s.field, ...p } } : s))
  const toField = () => setSpec(s => (s.mode === 'field' ? s : { mode: 'field', seed: s.seed, palette: s.palette, mask: s.mask, field: { kind: 'camo', cols: 40, rows: 50, scale: 10 } }))
  const mask: Mask = spec.mask ?? { shape: 'none', role: 0, inset: 0.1 }
  const setMask = (p: Partial<Mask>) => setSpec(s => ({ ...s, mask: { ...mask, ...p } }))
  const toPlaid = () => setSpec(s => (s.mode === 'plaid' ? s : { mode: 'plaid', seed: s.seed, palette: s.palette, plaid: { sett: null, mirror: true, weave: 'twill', cols: 48, rows: 48 } }))

  // ---------- Export ----------
  const svgEl = () => stage.current?.querySelector('svg') ?? null
  const save = (blob: Blob, name: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const exportSvg = () => {
    const el = svgEl()
    if (el) save(new Blob([svgString(el)], { type: 'image/svg+xml' }), 'kaleidoscope.svg')
  }
  const exportPng = async (long: number) => {
    const el = svgEl()
    if (!el) return
    const W = pattern.view?.w ?? pattern.grid[0].length, H = pattern.view?.h ?? pattern.grid.length
    const k = long / Math.max(W, H), w = Math.round(W * k), h = Math.round(H * k)
    const clone = el.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width', String(w))
    clone.setAttribute('height', String(h))
    const img = new Image()
    img.src = URL.createObjectURL(new Blob([svgString(clone)], { type: 'image/svg+xml' }))
    await img.decode()
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(img.src)
    c.toBlob(blob => blob && save(blob, 'kaleidoscope.png'), 'image/png')
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setNote('Link copied')
    } catch {
      setNote('Couldn’t copy the link')
    }
  }

  // ---------- Panels ----------
  const b = spec.mode === 'block' ? spec : null
  const pal = spec.palette

  const patternPanel = (
    <>
      <FieldGroup>
        <Field label="Kind">
          <Segmented label="Kind" value={spec.mode} onChange={m => (m === 'plaid' ? toPlaid() : m === 'field' ? toField() : setSpec(asBlock))} options={[{ value: 'block', label: 'Blocks' }, { value: 'plaid', label: 'Plaid' }, { value: 'field', label: 'Field' }]} />
        </Field>
      </FieldGroup>
      {b && (
        <FieldGroup title="Block">
          <Tiles label="Block">
            <Tile label="Generate" active={b.source === 'generate'} onClick={() => setSpec(s => ({ ...asBlock(s), source: 'generate' }))}>
              <Sparkles className="size-5 text-muted-foreground" strokeWidth={1.5} />
            </Tile>
            {LIBRARY.map(name => (
              <Tile key={name} label={name} active={b.source === name} onClick={() => setSpec(s => ({ ...asBlock(s), source: name }))}>
                <PatternSvg pattern={build({ ...b, source: name, layout: { ...b.layout, cols: 1, rows: 1, sashing: 0, repeat: 'grid', colourways: 1, invert: false } })} className="size-full" />
              </Tile>
            ))}
          </Tiles>
        </FieldGroup>
      )}
      {b?.source === 'generate' && (
        <FieldGroup title="Generate">
          <Field label="Across">
            <Slider min={1} max={10} step={1} value={[b.block.size]} onValueChange={([v]) => setBlock({ size: v, rows: b.block.rows ?? b.block.size })} aria-label="Cells across" />
          </Field>
          <Field label="Down">
            <Slider min={1} max={10} step={1} value={[b.block.rows ?? b.block.size]} onValueChange={([v]) => setBlock({ rows: v })} aria-label="Cells down" />
          </Field>
          <Field label="Symmetry">
            <Choices label="Symmetry" value={b.block.symmetry} onChange={v => setBlock({ symmetry: v })} options={SYMMETRIES} />
          </Field>
          <Field label="Fill">
            <Slider min={0.1} max={1} step={0.05} value={[b.block.density]} onValueChange={([v]) => setBlock({ density: v })} aria-label="Fill" />
          </Field>
          <Field label="Colours">
            <Slider min={2} max={Math.max(2, pal.count)} step={1} value={[Math.min(b.block.roles, pal.count)]} onValueChange={([v]) => setBlock({ roles: v })} aria-label="Colours" />
          </Field>
          {(['tri', 'split', 'quarter', 'half', 'bars'] as const).map(k => (
            <Field key={k} label={SHAPE_LABELS[k]}>
              <Slider min={0} max={2} step={0.1} value={[b.block.shapes[k]]} onValueChange={([v]) => setShapes({ [k]: v })} aria-label={SHAPE_LABELS[k]} />
            </Field>
          ))}
          <Button variant="secondary" onClick={() => setSpec(s => ({ ...asBlock(s), seed: newSeed() }))}>New block</Button>
        </FieldGroup>
      )}
      {spec.mode === 'field' && (
        <FieldGroup title="Field">
          <Field label="Kind">
            <Segmented<FieldKind> label="Field" value={spec.field.kind} onChange={v => setField({ kind: v })} options={[{ value: 'camo', label: 'Camo' }, { value: 'patches', label: 'Patches' }, { value: 'streaks', label: 'Streaks' }]} />
          </Field>
          <Field label="Across">
            <Slider min={4} max={120} step={1} value={[spec.field.cols]} onValueChange={([v]) => setField({ cols: v })} aria-label="Across" />
          </Field>
          <Field label="Down">
            <Slider min={4} max={150} step={1} value={[spec.field.rows]} onValueChange={([v]) => setField({ rows: v })} aria-label="Down" />
          </Field>
          {spec.field.kind !== 'patches' && (
            <Field label={spec.field.kind === 'camo' ? 'Blob size' : 'Run length'}>
              <Slider min={1} max={30} step={1} value={[spec.field.scale]} onValueChange={([v]) => setField({ scale: v })} aria-label="Scale" />
            </Field>
          )}
          <Button variant="secondary" onClick={() => setSpec(s => ({ ...s, seed: newSeed() }))}>New field</Button>
        </FieldGroup>
      )}
      <FieldGroup title="Shape">
        <Field label="Cut to">
          <Segmented<Mask['shape']> label="Cut to" value={mask.shape} onChange={v => setMask({ shape: v })} options={[{ value: 'none', label: 'None' }, { value: 'circle', label: 'Circle' }, { value: 'arch', label: 'Arch' }, { value: 'diamond', label: 'Diamond' }]} />
        </Field>
        {mask.shape !== 'none' && (
          <>
            <Field label="Margin">
              <Slider min={0} max={0.5} step={0.01} value={[mask.inset]} onValueChange={([v]) => setMask({ inset: v })} aria-label="Margin" />
            </Field>
            <Field label="Around">
              <RolePick label="Around" colours={pattern.colours} value={mask.role} onChange={v => setMask({ role: v ?? 0 })} />
            </Field>
          </>
        )}
      </FieldGroup>
      {spec.mode === 'plaid' && (
        <FieldGroup title="Plaid">
          <Field label="Weave">
            <Segmented label="Weave" value={spec.plaid.weave} onChange={v => setPlaid({ weave: v })} options={[{ value: 'plain', label: 'Plain' }, { value: 'twill', label: 'Twill' }, { value: 'over', label: 'Over' }, { value: 'under', label: 'Under' }]} />
          </Field>
          <Field label="Reflect">
            <OnOff label="Reflect" value={spec.plaid.mirror} onChange={v => setPlaid({ mirror: v })} />
          </Field>
          <Field label="Size">
            <Slider min={12} max={120} step={4} value={[spec.plaid.cols]} onValueChange={([v]) => setPlaid({ cols: v, rows: v })} aria-label="Size" />
          </Field>
          <Button variant="secondary" onClick={() => setSpec(s => ({ ...s, seed: newSeed() }))}>New stripes</Button>
        </FieldGroup>
      )}
    </>
  )

  const layoutPanel = b ? (
    <>
      <FieldGroup>
        <Field label="Repeat">
          <Choices label="Repeat" cols={4} value={b.layout.repeat} onChange={v => setLayout({ repeat: v })} options={REPEATS} />
        </Field>
        <Field label="Across">
          <Slider min={1} max={12} step={1} value={[b.layout.cols]} onValueChange={([v]) => setLayout({ cols: v })} aria-label="Across" />
        </Field>
        <Field label="Down">
          <Slider min={1} max={12} step={1} value={[b.layout.rows]} onValueChange={([v]) => setLayout({ rows: v })} aria-label="Down" />
        </Field>
        <Field label="Swap alternate">
          <OnOff label="Swap alternate" value={b.layout.invert} onChange={v => setLayout({ invert: v })} />
        </Field>
      </FieldGroup>
      <FieldGroup title="Sashing">
        <Field label="Width">
          <Slider min={0} max={3} step={1} value={[b.layout.sashing]} onValueChange={([v]) => setLayout({ sashing: v })} aria-label="Sashing" />
        </Field>
        <Field label="Strip">
          <RolePick label="Strip" colours={pattern.colours} value={b.layout.sashRole} onChange={v => setLayout({ sashRole: v ?? 0 })} />
        </Field>
        <Field label="Posts">
          <RolePick label="Posts" colours={pattern.colours} value={b.layout.postRole} onChange={v => setLayout({ postRole: v })} none />
        </Field>
      </FieldGroup>
      <FieldGroup title="Colourways">
        <Field label="Count">
          <Slider min={1} max={4} step={1} value={[b.layout.colourways]} onValueChange={([v]) => setLayout({ colourways: v })} aria-label="Colourways" />
        </Field>
        {b.layout.colourways > 1 && (
          <Field label="Order">
            <Segmented<Cycle> label="Order" value={b.layout.cycle} onChange={v => setLayout({ cycle: v })} options={[{ value: 'alternate', label: 'Alternate' }, { value: 'diagonal', label: 'Diagonal' }, { value: 'random', label: 'Random' }]} />
          </Field>
        )}
      </FieldGroup>
    </>
  ) : (
    <p className="text-xs text-muted-foreground">Only blocks repeat</p>
  )

  const colourPanel = (
    <>
      <FieldGroup>
        <Field label="Colour">
          <Slider min={0} max={1} step={0.01} value={[spec.tone ?? 1]} onValueChange={([v]) => setSpec(s => ({ ...s, tone: v }))} aria-label="Colour amount" />
        </Field>
      </FieldGroup>
      <FieldGroup title="Sets">
        <Tiles label="Colour set" cols={3}>
          {PRESETS.map(name => (
            <Tile key={name} label={name} active={pal.preset === name} onClick={() => setPalette({ preset: name, count: presets[name].length })}>
              <Strip colours={presets[name]} />
            </Tile>
          ))}
          <Tile label="Generated" active={!pal.preset} onClick={() => setPalette({ preset: undefined })}>
            <Strip colours={makePalette({ ...pal, preset: undefined })} />
          </Tile>
        </Tiles>
      </FieldGroup>
      {!pal.preset && (
        <FieldGroup title="Generated">
          <Field label="Scheme">
            <Choices<Scheme> label="Scheme" value={pal.scheme} onChange={v => setPalette({ scheme: v })} options={[
              { value: 'tonal', label: 'Tonal' }, { value: 'complement', label: 'Opposite' }, { value: 'split', label: 'Split' },
              { value: 'triad', label: 'Triad' }, { value: 'analogous', label: 'Near' }, { value: 'scatter', label: 'Scatter' },
            ]} />
          </Field>
          <Field label="Ground">
            <Segmented<Ground> label="Ground" value={pal.ground} onChange={v => setPalette({ ground: v })} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'colour', label: 'Colour' }]} />
          </Field>
          <Field label="Hue">
            <Slider min={0} max={359} step={1} value={[pal.hue ?? 0]} onValueChange={([v]) => setPalette({ hue: v })} aria-label="Hue" />
          </Field>
          <Field label="Colours">
            <Slider min={2} max={8} step={1} value={[pal.count]} onValueChange={([v]) => setPalette({ count: v })} aria-label="Colours" />
          </Field>
          <Button variant="secondary" onClick={() => setPalette({ seed: newSeed(), hue: null })}>New colours</Button>
        </FieldGroup>
      )}
      {b && (
        <FieldGroup title="Mix">
          <Field label="Palettes">
            <Slider min={1} max={8} step={1} value={[b.layout.palettes ?? 1]} onValueChange={([v]) => setLayout({ palettes: v })} aria-label="Palettes" />
          </Field>
        </FieldGroup>
      )}
      <FieldGroup title="In use">
        <div className="h-8 overflow-hidden rounded-md border border-border">
          <Strip colours={pattern.colours} />
        </div>
      </FieldGroup>
    </>
  )

  // Build: a few sliders that add complexity. Split, depth and shapes generate a block.
  // Scale: 0 is fine (64 cells across the frame), 1 is one big cell; even steps feel even (log)
  const MIN = 1.5, MAX = 64
  const cellsAcross = spec.scale ?? (pattern.view?.w ?? pattern.grid[0].length)
  const zoom = Math.log(MAX / cellsAcross) / Math.log(MAX / MIN)
  const setZoom = (z: number) => setSpec(s => ({ ...s, scale: MAX * (MIN / MAX) ** z, aspect: s.aspect ?? pattern.grid.length / pattern.grid[0].length }))
  const formats = [{ value: '1', label: '1:1' }, { value: '1.25', label: '4:5' }, { value: '1.7778', label: '9:16' }, { value: '0.5625', label: '16:9' }]
  const aspect = String(spec.aspect ?? 1)
  const setDepth = (v: number) => setSpec(s => {
    const blk = asBlock(s)
    const count = blk.palette.preset ? blk.palette.count : Math.max(blk.palette.count, v)
    return { ...blk, source: 'generate', block: { ...blk.block, roles: v }, palette: { ...blk.palette, count } }
  })
  const setAmount = (v: number) => setShapes({ tri: v, split: v * 0.6, quarter: v * 0.4, half: v * 0.4, bars: v * 0.3 })
  const buildPanel = (
    <FieldGroup>
      <Field label="Scale">
        <Slider min={0} max={1} step={0.005} value={[Math.max(0, Math.min(1, zoom))]} onValueChange={([v]) => setZoom(v)} aria-label="Scale" />
      </Field>
      <Field label="Format">
        <Segmented label="Format" value={formats.some(f => f.value === aspect) ? aspect : '1'} onChange={v => setSpec(s => ({ ...s, aspect: +v, scale: s.scale ?? cellsAcross }))} options={formats} />
      </Field>
      <Field label="Split across">
        <Slider min={1} max={10} step={1} value={[b?.block.size ?? 4]} onValueChange={([v]) => setBlock({ size: v, rows: b?.block.rows ?? b?.block.size ?? 4 })} aria-label="Split across" />
      </Field>
      <Field label="Split down">
        <Slider min={1} max={10} step={1} value={[b?.block.rows ?? b?.block.size ?? 4]} onValueChange={([v]) => setBlock({ rows: v })} aria-label="Split down" />
      </Field>
      <Field label="Depth">
        <Slider min={2} max={6} step={1} value={[b?.block.roles ?? 2]} onValueChange={([v]) => setDepth(v)} aria-label="Depth" />
      </Field>
      <Field label="Shapes">
        <Slider min={0} max={1.5} step={0.05} value={[b?.block.shapes.tri ?? 0]} onValueChange={([v]) => setAmount(v)} aria-label="Shapes" />
      </Field>
      <Field label="Colour">
        <Slider min={0} max={1} step={0.01} value={[spec.tone ?? 1]} onValueChange={([v]) => setSpec(s => ({ ...s, tone: v }))} aria-label="Colour" />
      </Field>
    </FieldGroup>
  )

  const looksPanel = (
    <Tiles label="Looks" cols={3}>
      {looks.map(l => (
        <Tile key={l.name} label={l.name} active={encode({ ...l.spec, tone: spec.tone }) === encode(spec)} onClick={() => setSpec({ ...l.spec, tone: 0 })}>
          <PatternSvg pattern={build({ ...l.spec, tone: 0 })} className="size-full" />
        </Tile>
      ))}
    </Tiles>
  )

  const exportPanel = (
    <FieldGroup>
      <Button variant="secondary" onClick={() => exportPng(2048)}>PNG 2K</Button>
      <Button variant="secondary" onClick={() => exportPng(4096)}>PNG 4K</Button>
      <Button variant="secondary" onClick={exportSvg}>SVG</Button>
      <Button variant="secondary" onClick={copyLink}>Copy link</Button>
    </FieldGroup>
  )

  return (
    <TooltipProvider delayDuration={400}>
      <Splash label="Loading">
        <path pathLength={1} d="M5 5h22v22H5z" />
        <path pathLength={1} d="M12.3 5v22" />
        <path pathLength={1} d="M19.7 5v22" />
        <path pathLength={1} d="M5 12.3h22" />
        <path pathLength={1} d="M5 19.7h22" />
      </Splash>
      <main
        ref={stage}
        className="fixed inset-0 grid place-items-center p-3 transition-[right,bottom] duration-200 sm:p-16 sm:pb-24"
        // The pattern keeps clear of the menus and any open panel
        style={phone ? { bottom: panel ? `${PHONE_SHEET * 100}dvh` : `calc(${SAFE_BOTTOM} + 56px)`, top: 'calc(env(safe-area-inset-top, 0px) + 60px)' } : { right: panel ? PANEL_W : 0 }}
      >
        <PatternSvg pattern={pattern} className="size-full" />
      </main>

      <PanelRail panels={panels} open={panel} onToggle={id => setPanel(panel === id ? null : id)} phone={phone} />

      <PanelSheet open={panel !== null} title={current?.label} onClose={() => setPanel(null)} phone={phone}>
        {panel === 'build' && buildPanel}
        {panel === 'looks' && looksPanel}
        {panel === 'pattern' && patternPanel}
        {panel === 'layout' && layoutPanel}
        {panel === 'colour' && colourPanel}
        {panel === 'export' && exportPanel}
      </PanelSheet>

      <ActionDock phone={phone} panelOpen={panel !== null}>
        {note && <div className="panel rounded-full px-3 py-1.5 text-xs">{note}</div>}
        <Toolbar aria-label="Pattern">
          <ToolButton icon={Shuffle} label="Shuffle" side="top" onClick={() => setSpec(shuffle)} />
          <ToolButton icon={Wand2} label="Recolour" side="top" onClick={() => setSpec(recolour)} />
          {b?.source === 'generate' && (
            <ToolButton icon={Sparkles} label="New block" side="top" onClick={() => setSpec(s => ({ ...asBlock(s), seed: newSeed(), block: { ...randomBlock(newSeed()), roles: asBlock(s).block.roles } }))} />
          )}
          <ToolButton icon={Undo2} label="Undo" side="top" onClick={undo} />
          <ToolbarSeparator />
          <ToolButton icon={Link} label="Copy link" side="top" onClick={copyLink} />
          <ToolButton icon={Download} label="Download PNG" side="top" onClick={() => exportPng(4096)} />
        </Toolbar>
      </ActionDock>
    </TooltipProvider>
  )
}

// A palette as bands across
function Strip({ colours }: { colours: readonly string[] }) {
  return (
    <div className="flex size-full">
      {colours.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
    </div>
  )
}

// Pick one of the pattern's colours by role, or none
function RolePick({ label, colours, value, onChange, none }: { label: string; colours: string[]; value: number | null; onChange: (v: number | null) => void; none?: boolean }) {
  const ring = 'outline-2 outline-offset-2 outline-foreground'
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {none && (
        <button type="button" role="radio" aria-checked={value === null} aria-label="None" onClick={() => onChange(null)}
          className={cn('grid size-7 place-items-center rounded-full border border-border text-muted-foreground', value === null && ring)}>
          <Ban className="size-4" strokeWidth={1.5} />
        </button>
      )}
      {colours.map((c, i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`Colour ${i + 1}`} onClick={() => onChange(i)}
          className={cn('size-7 rounded-full border border-border', value === i && ring)} style={{ background: c }} />
      ))}
    </div>
  )
}
