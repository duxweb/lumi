import { adminBaseConfigSchema } from '@duxweb/lumi-admin/catalog'
import { uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { lumiActionDefinitions, lumiComponentDefinitions, validateDocument } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { describe, expect, it } from 'vitest'
import { ADMIN_BASE_CONFIG, json, localizeSpec } from '../src/developer/source.js'
import { actionSpecs, startSpecs, stateSpecs } from '../src/json-specs.js'

describe('getting started examples', () => {
  it('renders plain UI with the Lumi UI Catalog alone, no Lumi services', () => {
    const catalog = defineCatalog(schema, { components: uiComponentDefinitions, actions: {} })
    expect(validateDocument(localizeSpec(startSpecs.structure, key => key), catalog)).toEqual({ valid: true, issues: [] })
  })

  it.each([['services', startSpecs.services], ['watch', stateSpecs.watch], ['submitForm', actionSpecs.submit]] as const)('validates the %s example with the shared service and UI Catalog', (_, spec) => {
    const catalog = defineCatalog(schema, { actions: lumiActionDefinitions, components: { ...lumiComponentDefinitions, ...uiComponentDefinitions } })
    expect(validateDocument(spec, catalog)).toEqual({ valid: true, issues: [] })
  })

  it('configures the prebuilt Admin base from the JSON shown on the page', () => {
    expect(adminBaseConfigSchema.safeParse(ADMIN_BASE_CONFIG).success).toBe(true)
  })
})

describe('example source', () => {
  const t = (key: string, params?: Record<string, unknown>): string => key === 'Hello, {name}' ? `你好，${String(params?.name)}。` : key

  it('shows $t resolved: plain text, or $template where the message reads state', () => {
    expect(localizeSpec({ label: { $t: 'Save' }, message: { $t: 'Hello, {name}', params: { name: { $state: '/name' } } } }, t)).toEqual({
      label: 'Save',
      // eslint-disable-next-line no-template-curly-in-string -- $template syntax.
      message: { $template: '你好，${/name}。' },
    })
  })

  it('keeps $t whose params read a repeat item', () => {
    const value = { $t: 'Remove {name}', params: { name: { $item: 'name' } } }
    expect(localizeSpec(value, t)).toBe(value)
  })

  it('prints JSON that parses back to the same value, short objects on one line', () => {
    const value = { root: 'card', elements: { card: { type: 'Card', props: { title: 'Workspace' }, children: [] } } }
    const text = json(value)
    expect(JSON.parse(text)).toEqual(value)
    expect(text).toContain('"props": { "title": "Workspace" }')
  })
})
