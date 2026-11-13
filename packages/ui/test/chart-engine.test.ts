// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountChart } from '../src/charts/engine.js'

const renderer = vi.hoisted(() => ({
  instances: [] as { autoFit: boolean, renderSync: ReturnType<typeof vi.fn>, resize: ReturnType<typeof vi.fn>, release: ReturnType<typeof vi.fn> }[],
}))

vi.mock('@visactor/vchart/esm/core', () => ({
  VChart: class {
    static useRegisters = vi.fn()
    renderSync = vi.fn()
    resize = vi.fn()
    release = vi.fn()
    autoFit: boolean

    constructor(_spec: unknown, options: { autoFit: boolean, dom: HTMLElement }) {
      this.autoFit = options.autoFit
      options.dom.style.position = 'relative'
      this.renderSync.mockImplementation(() => options.dom.style.position = 'relative')
      renderer.instances.push(this)
    }
  },
}))
vi.mock('@visactor/vchart/esm/chart/area/area', () => ({ registerAreaChart: vi.fn() }))
vi.mock('@visactor/vchart/esm/chart/bar/bar', () => ({ registerBarChart: vi.fn() }))
vi.mock('@visactor/vchart/esm/chart/line/line', () => ({ registerLineChart: vi.fn() }))
vi.mock('@visactor/vchart/esm/chart/pie/pie', () => ({ registerPieChart: vi.fn() }))
vi.mock('@visactor/vchart/esm/component/axis/cartesian/band-axis', () => ({ registerCartesianBandAxis: vi.fn() }))
vi.mock('@visactor/vchart/esm/component/axis/cartesian/linear-axis', () => ({ registerCartesianLinearAxis: vi.fn() }))
vi.mock('@visactor/vchart/esm/component/tooltip/tooltip', () => ({ registerTooltip: vi.fn() }))
vi.mock('@visactor/vchart/esm/plugin/components/tooltip-handler', () => ({ registerDomTooltipHandler: vi.fn() }))

afterEach(() => {
  document.body.replaceChildren()
  delete document.documentElement.dataset.theme
  renderer.instances.length = 0
  vi.unstubAllGlobals()
})

describe('chart canvas lifecycle', () => {
  it('preserves host dimensions after a theme redraw without another resize notification', async () => {
    let notifyResize: () => void = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) {
        notifyResize = callback
      }

      observe = vi.fn()
      disconnect = disconnect
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: () => ({ data: document.documentElement.dataset.theme === 'dark' ? [220, 220, 220, 255] : [20, 20, 20, 255] }),
    } as unknown as CanvasRenderingContext2D)
    const host = document.createElement('div')
    let width = 1216
    let height = 240
    Object.defineProperties(host, {
      clientWidth: { get: () => width },
      clientHeight: { get: () => host.style.position === 'relative' ? 500 : height },
    })
    document.body.append(host)
    const release = mountChart(host, { type: 'area', ariaLabel: 'Revenue', points: [{ label: 'Monday', value: 12 }] })
    const initial = renderer.instances[0]!
    expect(host.style.position).toBe('')
    expect(initial.autoFit).toBe(false)
    expect(initial.resize).toHaveBeenLastCalledWith(1216, 240)

    document.documentElement.dataset.theme = 'dark'
    await Promise.resolve()
    expect(renderer.instances).toHaveLength(2)
    expect(initial.release).toHaveBeenCalledOnce()
    const themed = renderer.instances[1]!
    expect(themed.autoFit).toBe(false)
    expect(themed.resize).toHaveBeenLastCalledWith(1216, 240)

    width = 320
    height = 300
    notifyResize()
    expect(themed.resize).toHaveBeenLastCalledWith(320, 300)
    expect(initial.resize).toHaveBeenCalledOnce()

    release()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(themed.release).toHaveBeenCalledOnce()
  })
})
