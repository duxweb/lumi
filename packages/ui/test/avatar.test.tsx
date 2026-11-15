import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { uiComponentDefinitions } from '../src/catalog/definitions.js'
import { LumiAvatar, LumiAvatarGroup } from '../src/components/avatar.js'

const css = readFileSync(resolve(import.meta.dirname, '../src/style.css'), 'utf8')
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, selector).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

describe('lumiAvatar', () => {
  it('offers an xl size for profile headers; a group keeps the control sizes', () => {
    expect(uiComponentDefinitions.Avatar.props.safeParse({ name: 'Ada Admin', size: 'xl' }).success).toBe(true)
    expect(uiComponentDefinitions.AvatarGroup.props.safeParse({ items: [{ name: 'Ada Admin' }], size: 'xl' }).success).toBe(false)
    const html = renderToStaticMarkup(<LumiAvatar name="Ada Admin" size="xl" />)
    expect(html).toContain('size-[calc(var(--lumi-control-md)*2)]')
    expect(html).toContain('>AA</span>')
  })

  it('draws no outline by default; only an overlapping group rings each avatar in the surface colour', () => {
    expect(rule('[data-slot="avatar"][data-tint]')).not.toContain('box-shadow')
    expect(css).not.toMatch(/\[data-slot="avatar"\][^{]*\{[^}]*inset 0 0 0 1px/)
    expect(rule('[data-slot="avatar-group"] [data-slot="avatar"]')).toContain('box-shadow: 0 0 0 2px var(--card)')
    const group = renderToStaticMarkup(<LumiAvatarGroup items={[{ name: 'Ada Admin' }, { name: 'Mina Manager' }]} />)
    expect(group).toContain('data-slot="avatar-group"')
  })
})
