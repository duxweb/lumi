import type { PointerEvent, ReactElement } from 'react'
import type { SignaturePadProps } from '../catalog/types-public.js'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { TrashIcon, UndoIcon } from '../icons.js'
import { FIELD_DISABLED_WITHIN, FIELD_SURFACE } from '../internal/field-surface.js'
import { Button } from '../internal/shadcn/button.js'
import { cn } from '../internal/utils.js'
import { useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

interface Point { x: number, y: number }

/**
 * Ink without a `penColor` is saved black, so a signature reads the same on
 * whatever page shows it later; a dark theme inverts the canvas on screen.
 */
const SAVED_INK = '#000000'
const LINE_WIDTH = 2.25

/** Strokes through the midpoints of their samples, which smooths the jitter of raw pointer input. */
function drawStroke(context: CanvasRenderingContext2D, points: Point[]): void {
  const [first] = points
  if (!first)
    return
  context.beginPath()
  if (points.length === 1) {
    context.arc(first.x, first.y, LINE_WIDTH / 2, 0, Math.PI * 2)
    context.fill()
    return
  }
  context.moveTo(first.x, first.y)
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index]!
    const next = points[index + 1]!
    context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2)
  }
  const last = points.at(-1)!
  context.lineTo(last.x, last.y)
  context.stroke()
}

/** Draws a signature with a pointer; the value is a PNG data URL. */
export function LumiSignaturePad(props: SignaturePadProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = '', onChange, height = 160, penColor, placeholder = t('lumi.signature.placeholder', 'Sign here'), name, disabled, readonly, invalid, error, ariaLabel, className, id } = props
  const [current, setCurrent] = useControllableValue(value, defaultValue, onChange)
  const errorId = useId()
  const describedBy = [props['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') || undefined
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const strokes = useRef<Point[][]>([])
  const drawing = useRef(false)
  /** A value that arrived from outside is kept as an image under any new strokes. */
  const base = useRef<HTMLImageElement | null>(null)
  const emitted = useRef<string>(undefined)
  const [width, setWidth] = useState(0)
  const [strokeCount, setStrokeCount] = useState(0)
  const [hasBase, setHasBase] = useState(false)
  const [baseLoads, setBaseLoads] = useState(0)
  const locked = disabled || readonly
  const label = ariaLabel ?? props['aria-label'] ?? t('lumi.signature.name', 'Signature')
  const empty = strokeCount === 0 && !hasBase

  const redraw = useCallback((): void => {
    const element = canvas.current
    const context = element?.getContext?.('2d')
    if (!element || !context || !width)
      return
    const ratio = window.devicePixelRatio || 1
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    const image = base.current
    if (image?.complete && image.naturalWidth) {
      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
      context.drawImage(image, 0, 0, image.naturalWidth * scale, image.naturalHeight * scale)
    }
    context.strokeStyle = penColor ?? SAVED_INK
    context.fillStyle = penColor ?? SAVED_INK
    context.lineWidth = LINE_WIDTH
    context.lineCap = 'round'
    context.lineJoin = 'round'
    for (const stroke of strokes.current)
      drawStroke(context, stroke)
  }, [width, height, penColor])

  useEffect(() => {
    const element = frame.current
    if (!element)
      return
    setWidth(element.clientWidth)
    if (typeof ResizeObserver === 'undefined')
      return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // A value set from outside (initial data, a reset) replaces the drawing.
  useEffect(() => {
    if ((current ?? '') === (emitted.current ?? ''))
      return
    emitted.current = current
    strokes.current = []
    setStrokeCount(0)
    if (!current) {
      base.current = null
      setHasBase(false)
      redraw()
      return
    }
    const image = new Image()
    // The pad may measure its width while the image decodes; the load schedules
    // a redraw at the current size rather than calling the one captured here.
    image.onload = () => setBaseLoads(count => count + 1)
    image.src = current
    base.current = image
    setHasBase(true)
  }, [current, redraw])

  useLayoutEffect(redraw, [redraw, baseLoads])

  const emit = (): void => {
    const hasInk = strokes.current.length > 0 || base.current !== null
    const next = hasInk ? canvas.current?.toDataURL('image/png') ?? '' : ''
    emitted.current = next
    setCurrent(next)
  }
  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (locked || event.button !== 0)
      return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drawing.current = true
    strokes.current.push([point(event)])
    redraw()
  }
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (!drawing.current)
      return
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? []
    const stroke = strokes.current.at(-1)!
    const rect = event.currentTarget.getBoundingClientRect()
    if (samples.length)
      stroke.push(...samples.map(sample => ({ x: sample.clientX - rect.left, y: sample.clientY - rect.top })))
    else
      stroke.push(point(event))
    redraw()
  }
  const onPointerUp = (): void => {
    if (!drawing.current)
      return
    drawing.current = false
    setStrokeCount(strokes.current.length)
    emit()
  }
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)} data-slot="lumi-signature-pad" data-testid={props['data-testid']}>
      {name && <input type="hidden" name={name} value={current ?? ''} disabled={disabled} />}
      <div
        ref={frame}
        id={id}
        className={cn(FIELD_SURFACE, FIELD_DISABLED_WITHIN, 'relative w-full overflow-hidden')}
        style={{ height }}
        data-slot="signature-frame"
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        data-empty={empty || undefined}
      >
        <canvas
          ref={canvas}
          className={cn('absolute inset-0 block size-full touch-none', !penColor && 'dark:invert', locked ? 'cursor-default' : 'cursor-crosshair')}
          role="img"
          aria-label={empty ? t('lumi.signature.empty', '{name}, not signed', { name: label }) : t('lumi.signature.signed', '{name}, signed', { name: label })}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-x-6 bottom-8 flex items-end border-b border-dashed border-input pb-1 text-meta text-muted-foreground select-none" aria-hidden data-slot="signature-placeholder">
            {placeholder}
          </span>
        )}
        {!locked && (
          <div className="absolute top-1.5 right-1.5 flex gap-0.5" data-slot="signature-actions">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={strokeCount === 0}
              aria-label={t('lumi.signature.undo', 'Undo stroke')}
              title={t('lumi.signature.undo', 'Undo stroke')}
              onClick={() => {
                strokes.current.pop()
                setStrokeCount(strokes.current.length)
                redraw()
                emit()
              }}
            >
              <UndoIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={empty}
              aria-label={t('lumi.signature.clear', 'Clear signature')}
              title={t('lumi.signature.clear', 'Clear signature')}
              onClick={() => {
                strokes.current = []
                base.current = null
                setStrokeCount(0)
                setHasBase(false)
                redraw()
                emit()
              }}
            >
              <TrashIcon />
            </Button>
          </div>
        )}
      </div>
      {error && <p id={errorId} role="alert" className="text-meta text-destructive" data-slot="signature-pad-error">{error}</p>}
    </div>
  )
}
