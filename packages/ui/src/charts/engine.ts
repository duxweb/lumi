import type { ISpec } from '@visactor/vchart'
import type { LumiChartProps } from '../catalog/types-public.js'
import { registerAreaChart } from '@visactor/vchart/esm/chart/area/area'
import { registerLineChart } from '@visactor/vchart/esm/chart/line/line'
import { registerPieChart } from '@visactor/vchart/esm/chart/pie/pie'
import { registerCartesianBandAxis } from '@visactor/vchart/esm/component/axis/cartesian/band-axis'
import { registerCartesianLinearAxis } from '@visactor/vchart/esm/component/axis/cartesian/linear-axis'
import { registerTooltip } from '@visactor/vchart/esm/component/tooltip/tooltip'
import { VChart } from '@visactor/vchart/esm/core'
import { registerDomTooltipHandler } from '@visactor/vchart/esm/plugin/components/tooltip-handler'
import { chartPoints, formatChartValue } from './model.js'

VChart.useRegisters([registerAreaChart, registerLineChart, registerPieChart, registerCartesianBandAxis, registerCartesianLinearAxis, registerTooltip, registerDomTooltipHandler])

const ALPHA_RE = /,[\d.]+\)$/

/** The same colour at another opacity, for gradients built from a token. */
function fade(rgba: string, alpha: number): string {
  return rgba.replace(ALPHA_RE, `,${alpha})`)
}

/** Canvas libraries need resolved RGB, not CSS variables or OKLCH expressions. */
function palette(element: HTMLElement): Record<string, string> {
  const probe = document.createElement('span')
  const context = document.createElement('canvas').getContext('2d')!
  element.append(probe)
  const colors: Record<string, string> = {}
  for (const name of ['foreground', 'muted-foreground', 'border', 'card', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']) {
    probe.style.color = `var(--${name})`
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = getComputedStyle(probe).color
    context.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0, a = 255] = context.getImageData(0, 0, 1, 1).data
    colors[name] = `rgba(${r},${g},${b},${a / 255})`
  }
  probe.remove()
  return colors
}

/** Draws area, line and donut charts; bars are layout in `chart.tsx`. */
export function mountChart(element: HTMLElement, props: LumiChartProps): () => void {
  let chart: VChart | undefined
  let renderedTheme = ''
  const hostPosition = element.style.position
  const resizeChart = (): void => {
    if (element.clientWidth > 0 && element.clientHeight > 0)
      chart?.resize(element.clientWidth, element.clientHeight)
  }
  const draw = (): void => {
    const colors = palette(element)
    const fontFamily = getComputedStyle(element).fontFamily
    const themeKey = JSON.stringify([colors, fontFamily])
    if (chart && themeKey === renderedTheme)
      return
    chart?.release()
    const categorical = props.type === 'donut'
    const points = chartPoints(props.type, props.points)
    const accent = colors[`chart-${props.color ?? 1}`]!
    const axis = { domainLine: { visible: false }, tick: { visible: false }, label: { style: { fill: colors['muted-foreground'], fontSize: 11, fontFamily } } }
    const spec = {
      type: categorical ? 'pie' : props.type,
      animation: false,
      background: 'transparent',
      padding: categorical ? 8 : { top: 12, right: 12, bottom: 0, left: 0 },
      data: { id: 'values', values: points },
      color: categorical ? [1, 2, 3, 4, 5].map(index => colors[`chart-${index}`]) : [colors[`chart-${props.color ?? 1}`]],
      ...(categorical
        ? { valueField: 'value', categoryField: 'label', innerRadius: 0.76, outerRadius: 0.94, pie: { style: { cornerRadius: 0, stroke: colors.card, lineWidth: 3 } } }
        : {
            xField: 'label',
            yField: 'value',
            axes: [
              { ...axis, orient: 'bottom', type: 'band', grid: { visible: false } },
              { ...axis, orient: 'left', type: 'linear', zero: true, grid: { visible: true, style: { stroke: colors.border, lineDash: [3, 3] } }, label: { style: axis.label.style, formatMethod: (value: string | number) => formatChartValue(Number(value), props, true) } },
            ],
            area: { style: { curveType: 'monotone', fill: { gradient: 'linear', x0: 0, y0: 0, x1: 0, y1: 1, stops: [{ offset: 0, color: fade(accent, 0.24) }, { offset: 1, color: fade(accent, 0) }] } } },
            line: { style: { lineWidth: 2, curveType: 'monotone' } },
            point: { visible: props.type === 'line' || points.length === 1, style: { size: 7, fill: accent, stroke: colors.card, lineWidth: 2 } },
          }),
      // HTML, not canvas: the tooltip must sit above the donut's centre label and
      // can only frost what is behind it as a real element.
      tooltip: { renderMode: 'html', className: 'lumi-chart-tooltip', mark: { title: { value: (datum: { label: string }) => datum.label }, content: [{ key: props.ariaLabel, value: (datum: { value: number }) => formatChartValue(datum.value, props) }] }, style: { panel: { padding: { top: 8, bottom: 8, left: 12, right: 12 }, backgroundColor: 'transparent', border: { color: colors.border, width: 1, radius: 8 }, shadow: { x: 0, y: 8, blur: 24, spread: -8, color: 'rgba(0,0,0,0.18)' } }, titleLabel: { fill: colors.foreground, fontSize: 12, fontWeight: 600, fontFamily }, keyLabel: { fill: colors['muted-foreground'], fontSize: 12, fontFamily }, valueLabel: { fill: colors.foreground, fontSize: 12, fontWeight: 600, fontFamily }, shape: { size: 8 } } },
    } as ISpec
    // Lumi's observer owns sizing, including canvases recreated for a theme.
    chart = new VChart(spec, { dom: element, autoFit: false, animation: false })
    chart.renderSync()
    // VChart writes position:relative; retain the host's CSS-sized layout.
    element.style.position = hostPosition
    // A theme redraw replaces the canvas without resizing its host.
    resizeChart()
    renderedTheme = themeKey
  }
  try {
    draw()
  }
  catch (error) {
    chart?.release()
    throw error
  }
  const resize = new ResizeObserver(resizeChart)
  resize.observe(element)
  const theme = new MutationObserver(draw)
  for (let ancestor: HTMLElement | null = element.parentElement; ancestor; ancestor = ancestor.parentElement)
    theme.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
  return () => {
    theme.disconnect()
    resize.disconnect()
    chart?.release()
  }
}
