import { useEffect, useMemo, useRef, useState } from 'react'
import { Ban, Download, Eye, Grid2x2, Grid3x3, Palette, Shuffle, Undo2, Wand2 } from 'lucide-react'
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
import { type LayoutSpec, type PaletteSpec, type Spec, build, decode, encode, library, makePalette, presets } from '@/lib/pattern'
import { PRESETS, QUILT, REPEATS, acrossToScale, blockDefaults, newSeed, quilt, randomPalette, recolour, scaleToAcross, shuffle } from '@/state'
import { cn } from '@/lib/utils'
import { looks } from '@/looks'
import { useStepZoom } from '@/gestures'

// tessera: quilt blocks on a grid, in random colours. Pattern sets the form, Colour the colours,
// Looks has starting points, Export saves. Pinch or drag to change how many blocks fit.
// The whole pattern lives in the URL, so any look can be shared or bookmarked.

const panels = [
  { id: 'pattern', label: 'Pattern', icon: Grid2x2 },
  { id: 'colour', label: 'Colour', icon: Palette },
  { id: 'looks', label: 'Looks', icon: Eye },
  { id: 'export', label: 'Export', icon: Download },
] as const
type PanelId = (typeof panels)[number]['id']

type BlockMode = Extract<Spec, { mode: 'block' }>

const FORMATS = [{ value: '1', label: '1:1' }, { value: '1.25', label: '4:5' }, { value: '1.7778', label: '9:16' }, { value: '0.5625', label: '16:9' }]
const GRID_LOOKS = looks.filter(l => l.spec.mode === 'block')
// A look opens in a square frame of its own blocks across, so it fills the square, zooms and slides
const framedLook = (spec: Spec): Spec => { const q = spec as BlockMode; return { ...q, scale: acrossToScale(q, q.layout.cols), aspect: 1, offset: undefined } }
// Block tiles run small to big: by cells across, then down
const BLOCKS = [...QUILT].sort((a, b) => library[a][0].length - library[b][0].length || library[a].length - library[b].length)

// A fresh random quilt in random colours each time the app opens without a link
const randomStart = (): Spec => quilt(newSeed(), randomPalette(newSeed()))
const fromHash = (): Spec => {
  const s = location.hash.length > 1 ? decode(location.hash) : null
  return s?.mode === 'block' ? s : randomStart()
}

export default function App() {
  const phone = usePhone()
  const [panel, setPanel] = useState<PanelId | null>(() => (matchMedia('(max-width: 639px)').matches ? null : 'pattern'))
  const [spec, setSpecRaw] = useState<Spec>(fromHash)
  const past = useRef<Spec[]>([])
  const [note, setNote] = useState('')
  // The light grid over the pattern, on by default; the choice is remembered on this device
  const [lines, setLines] = useState(() => { try { return localStorage.getItem('tessera:lines') !== 'off' } catch { return true } })
  useEffect(() => { try { localStorage.setItem('tessera:lines', lines ? 'on' : 'off') } catch { /* storage unavailable */ } }, [lines])
  const stage = useRef<HTMLElement>(null)
  const current = panels.find(p => p.id === panel)

  const pattern = useMemo(() => build(spec), [spec])

  // The space the pattern has, so it can be drawn at a whole number of pixels per cell:
  // every edge then lands on a pixel, with no slivers or seams
  const [room, setRoom] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      setRoom({ w: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // The frame is the largest box of the pattern's shape that fits, snapped to whole device pixels,
  // so it holds still as cell counts change; the cells divide it evenly
  const view = pattern.view ?? { w: pattern.grid[0].length, h: pattern.grid.length }
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
  const snap = (v: number) => Math.round(v * dpr) / dpr
  const fit = Math.min(room.w / view.w, room.h / view.h)
  const frameW = snap(fit * view.w), frameH = snap(fit * view.h)
  const cellPx = fit
  const size = room.w
    ? { width: frameW, height: frameH, placeSelf: 'start', marginLeft: snap((room.w - frameW) / 2), marginTop: snap((room.h - frameH) / 2) }
    : undefined

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

  // Keys: space shuffles, c recolours, g shows or hides the grid, cmd/ctrl+z undoes
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, [role=slider]')) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo() }
      else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); setSpec(shuffle) }
      else if (e.key === 'c' && !e.metaKey && !e.ctrlKey) setSpec(recolour)
      else if (e.key === 'g' && !e.metaKey && !e.ctrlKey) setLines(v => !v)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- Changes ----------
  const asBlock = (s: Spec): BlockMode => (s.mode === 'block' ? s : { ...blockDefaults, seed: s.seed, palette: s.palette })
  const b = asBlock(spec)
  const across = scaleToAcross(b)
  // Changes that alter a block's footprint keep the same number of blocks across
  const keepAcross = (s: Spec, next: BlockMode, n = scaleToAcross(asBlock(s))): Spec => ({ ...next, scale: acrossToScale(next, n), aspect: next.aspect ?? 1 })
  const setAcross = (n: number) => setSpec(s => keepAcross(s, asBlock(s), n))
  const setLayout = (p: Partial<LayoutSpec>) => setSpec(s => { const q = asBlock(s); return { ...q, layout: { ...q.layout, ...p } } })
  const setGap = (g: number) => setSpec(s => { const q = asBlock(s); return keepAcross(s, { ...q, layout: { ...q.layout, sashing: g } }) })
  const pickBlock = (name: (typeof QUILT)[number]) => setSpec(s => keepAcross(s, { ...asBlock(s), source: name }))
  // Choosing colours brings colour in if the pattern was faded to black and white
  const coloured = (s: Spec): Spec => ((s.tone ?? 1) < 0.05 ? { ...s, tone: 1 } : s)

  // Pinch, drag up and down, or the wheel: blocks across, a whole block at a time.
  // The gesture is one undo step: it checkpoints once, then steps without adding history.
  const latest = useRef(spec)
  latest.current = spec
  const cellRef = useRef(20)
  cellRef.current = cellPx
  useStepZoom(stage, {
    value: () => scaleToAcross(asBlock(latest.current)),
    set: n => setSpecRaw(s => keepAcross(s, asBlock(s), n)),
    begin: () => { past.current = [...past.current.slice(-60), latest.current] },
    min: 1,
    max: 16,
    offset: () => latest.current.offset ?? [0, 0],
    slide: (x, y) => setSpecRaw(s => ({ ...s, offset: [x, y] })),
    cellPx: () => cellRef.current,
  })

  // ---------- Export ----------
  // The pattern as it exports: without the editing grid
  const svgEl = () => {
    const el = stage.current?.querySelector('svg')
    if (!el) return null
    const clone = el.cloneNode(true) as SVGSVGElement
    clone.querySelectorAll('[data-overlay]').forEach(n => n.remove())
    return clone
  }
  const save = (blob: Blob, name: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const exportSvg = () => {
    const el = svgEl()
    if (el) save(new Blob([svgString(el)], { type: 'image/svg+xml' }), 'tessera.svg')
  }
  const exportPng = async (long: number) => {
    const el = svgEl()
    if (!el) return
    const W = pattern.view?.w ?? pattern.grid[0].length, H = pattern.view?.h ?? pattern.grid.length
    const k = long / Math.max(W, H), w = Math.round(W * k), h = Math.round(H * k)
    const clone = el
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
    c.toBlob(blob => blob && save(blob, 'tessera.png'), 'image/png')
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
  // Pattern: the block, how many fit, how they repeat, the gaps between, the frame
  const baseColours = pattern.colours.slice(0, spec.palette.count)
  const aspect = String(spec.aspect ?? 1)
  const patternPanel = (
    <>
      <FieldGroup title="Block">
        <Tiles label="Block">
          {BLOCKS.map(name => (
            <Tile key={name} label={name} active={b.source === name} onClick={() => pickBlock(name)}>
              <PatternSvg pattern={build({ ...b, source: name, tone: 0, scale: undefined, offset: undefined, mask: undefined, layout: { ...b.layout, cols: 1, rows: 1, sashing: 0, repeat: 'grid', invert: false, palettes: 1 } })} className="size-full" lines />
            </Tile>
          ))}
        </Tiles>
      </FieldGroup>
      <FieldGroup>
        <Field label="Blocks across">
          <Slider min={1} max={16} step={1} value={[across]} onValueChange={([v]) => setAcross(v)} aria-label="Blocks across" />
        </Field>
        <Field label="Repeat">
          <Choices label="Repeat" cols={4} value={b.layout.repeat} onChange={v => setLayout({ repeat: v })} options={REPEATS} />
        </Field>
        <Field label="Swap alternate">
          <OnOff label="Swap alternate" value={b.layout.invert} onChange={v => setLayout({ invert: v })} />
        </Field>
        <Field label="Gap">
          <Slider min={0} max={3} step={1} value={[b.layout.sashing]} onValueChange={([v]) => setGap(v)} aria-label="Gap" />
        </Field>
        {b.layout.sashing > 0 && (
          <>
            <Field label="Gap colour">
              <RolePick label="Gap colour" colours={baseColours} value={b.layout.sashRole} onChange={v => setLayout({ sashRole: v ?? 0 })} />
            </Field>
            <Field label="Corners">
              <RolePick label="Corners" colours={baseColours} value={b.layout.postRole} onChange={v => setLayout({ postRole: v })} none />
            </Field>
          </>
        )}
        <Field label="Format">
          <Segmented label="Format" value={FORMATS.some(f => f.value === aspect) ? aspect : '1'} onChange={v => setSpec(s => keepAcross(s, { ...asBlock(s), aspect: +v }))} options={FORMATS} />
        </Field>
      </FieldGroup>
    </>
  )

  // Colour: random colours or a set, mixed or not, and how much colour at all.
  // Mix off: a tap picks the colours for every block. Mix on: taps choose the sets the blocks take
  // turns between; Random gives every block its own random colours.
  const pal = spec.palette
  const randomMix = (b.layout.palettes ?? 1) > 1
  const mixing = pal.mix !== undefined || randomMix
  const generated = (): PaletteSpec => {
    let p = randomPalette(newSeed())
    while (p.preset) p = randomPalette(newSeed())
    return p
  }
  const setColours = (palette: PaletteSpec, palettes: number) => setSpec(s => { const q = asBlock(s); return coloured({ ...q, palette, layout: { ...q.layout, palettes } }) })
  const setMixing = (on: boolean) => on
    ? setColours(pal.preset ? { ...pal, mix: [pal.preset] } : { ...pal, mix: undefined }, pal.preset ? 1 : 12)
    : setColours({ ...pal, mix: undefined, preset: pal.mix?.[0] ?? pal.preset }, 1)
  const pickRandom = () => setColours({ ...generated(), mix: undefined }, mixing ? 12 : 1)
  const pickSet = (name: (typeof PRESETS)[number]) => {
    if (!mixing || randomMix) return setColours({ ...pal, preset: name, count: presets[name].length, mix: mixing ? [name] : undefined }, 1)
    const now = pal.mix ?? []
    const next = now.includes(name) ? (now.length > 1 ? now.filter(n => n !== name) : now) : [...now, name]
    setColours({ ...pal, preset: next[0], count: presets[next[0]].length, mix: next }, 1)
  }
  const colourPanel = (
    <>
      <FieldGroup>
        <Field label="Mix">
          <OnOff label="Mix" value={mixing} onChange={setMixing} />
        </Field>
        <Tiles label="Colours" cols={4}>
          <Tile label="Random" active={mixing ? randomMix : !pal.preset} onClick={pickRandom}>
            {pal.preset ? <Shuffle className="size-5 text-muted-foreground" strokeWidth={1.5} /> : <Strip colours={makePalette(pal)} />}
          </Tile>
          {PRESETS.map(name => (
            <Tile key={name} label={name} active={mixing ? !randomMix && !!pal.mix?.includes(name) : pal.preset === name} onClick={() => pickSet(name)}>
              <Strip colours={presets[name]} />
            </Tile>
          ))}
        </Tiles>
      </FieldGroup>
      <FieldGroup>
        <Field label="Colour">
          <Slider min={0} max={1} step={0.01} value={[spec.tone ?? 1]} onValueChange={([v]) => setSpec(s => ({ ...s, tone: v }))} aria-label="Colour" />
        </Field>
      </FieldGroup>
    </>
  )

  const looksPanel = (
    <Tiles label="Looks" cols={3}>
      {GRID_LOOKS.map(l => (
        <Tile key={l.name} label={l.name} active={b.source === (l.spec as BlockMode).source && b.layout.repeat === (l.spec as BlockMode).layout.repeat && JSON.stringify(l.spec.palette) === JSON.stringify(spec.palette)}
          onClick={() => setSpec(framedLook(l.spec))}>
          <PatternSvg pattern={build(framedLook(l.spec))} className="size-full" cover />
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
        data-keep-panel
        className="fixed inset-0 grid touch-none select-none place-items-center p-3 transition-[right,bottom] duration-200 sm:p-16 sm:pb-24"
        // The pattern keeps clear of the menus and any open panel
        style={phone ? { bottom: panel ? `${PHONE_SHEET * 100}dvh` : `calc(${SAFE_BOTTOM} + 56px)`, top: 'calc(env(safe-area-inset-top, 0px) + 60px)' } : { right: panel ? PANEL_W : 0 }}
      >
        <PatternSvg pattern={pattern} className={size ? undefined : 'size-full'} style={size} lines={lines} />
      </main>

      <PanelRail panels={panels} open={panel} onToggle={id => setPanel(panel === id ? null : id)} phone={phone} />

      <PanelSheet open={panel !== null} title={current?.label} onClose={() => setPanel(null)} phone={phone}>
        {panel === 'pattern' && patternPanel}
        {panel === 'colour' && colourPanel}
        {panel === 'looks' && looksPanel}
        {panel === 'export' && exportPanel}
      </PanelSheet>

      <ActionDock phone={phone} panelOpen={panel !== null}>
        {note && <div className="panel rounded-full px-3 py-1.5 text-xs">{note}</div>}
        <Toolbar aria-label="Actions">
          <ToolButton icon={Shuffle} label="Shuffle" side="top" onClick={() => setSpec(shuffle)} />
          <ToolButton icon={Wand2} label="Recolour" side="top" onClick={() => setSpec(s => coloured(recolour(s)))} />
          <ToolButton icon={Undo2} label="Undo" side="top" onClick={undo} />
          <ToolbarSeparator />
          <ToolButton icon={Grid3x3} label={lines ? 'Hide grid' : 'Show grid'} side="top" active={lines} onClick={() => setLines(v => !v)} />
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

// Pick one of the palette's colours, or none
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
