import { readFileSync } from 'node:fs'
import { themeConfigSchema } from '@duxweb/lumi-ui/catalog'
import { validateDocument } from '@duxweb/lumi/catalog'
import { describe, expect, it } from 'vitest'
import { catalog } from '../src/catalog'

const themeFiles = [new URL('../../../packages/create/templates/react/src/theme.json', import.meta.url), new URL('../../react-demo/theme.json', import.meta.url), new URL('../public/theme.json', import.meta.url)]
describe('react delivery fixtures', () => {
  it('uses one validated theme across delivery modes', () => {
    const themes = themeFiles.map(file => JSON.parse(readFileSync(file, 'utf8')))
    for (const theme of themes) expect(themeConfigSchema.safeParse(theme).success).toBe(true)
    expect(themes).toEqual(themes.map(() => themes[0]))
  })
  it('validates remotely delivered native Specs with the host catalog', () => {
    for (const name of ['home', 'workflow']) {
      const spec = JSON.parse(readFileSync(new URL(`../public/pages/${name}.json`, import.meta.url), 'utf8'))
      expect(validateDocument(spec, catalog)).toEqual({ valid: true, issues: [] })
    }
  })
})
