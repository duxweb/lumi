import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ShellIcon } from '../src/react/components/ShellIcon.js'

function drawing(name: string): string {
  return renderToStaticMarkup(<ShellIcon name={name} />)
    .replace(/ data-lumi-icon-name="[^"]*"/u, '')
}

describe('shell navigation icons', () => {
  it.each([
    ['blocks', 'layout-grid'],
    ['pen-line', 'square-pen'],
    ['square-stack', 'layers'],
  ])('gives %s and %s distinct drawings', (first, second) => {
    expect(drawing(first)).not.toBe(drawing(second))
  })
})
