import { afterEach, beforeEach, expect, vi } from 'vitest'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let consoleErrors: unknown[][] = []

beforeEach(() => {
  consoleErrors = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args)
  })
})

afterEach(() => {
  expect(consoleErrors, 'Unexpected console.error output').toEqual([])
  vi.restoreAllMocks()
})

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}
  }
}

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView === 'undefined')
  Element.prototype.scrollIntoView = () => {}
