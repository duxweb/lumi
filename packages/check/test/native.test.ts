import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateDocument } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { checkDocument, defaultCatalog, describeComponent, getCatalog } from '../src/index.js'

const valid = { root: 'page', elements: { page: { type: 'Alert', props: { message: 'Hello' } } } }
const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
const root = fileURLToPath(new URL('../../../', import.meta.url))
const lookup = (args: string[]) => spawnSync(process.execPath, ['--conditions=lumi:source', '--import', 'tsx', cli, ...args], { cwd: root, encoding: 'utf8', input: '' })
const run = (input: unknown, args: string[] = []) => spawnSync(process.execPath, ['--conditions=lumi:source', '--import', 'tsx', cli, '-', '--json', ...args], { cwd: root, encoding: 'utf8', input: JSON.stringify(input) })

describe('native Catalog checker', () => {
  it('shares runtime diagnostics and accepts optional native children', () => {
    expect(checkDocument(valid)).toEqual({ valid: true, issues: [] })
    const invalid = { ...valid, elements: { page: { type: 'Missing', props: {} } } }
    expect(checkDocument(invalid)).toEqual(validateDocument(invalid, defaultCatalog))
  })
  it.each([
    { root: 'missing', elements: {} },
    { ...valid, protocolVersion: '1' },
    { ...valid, elements: { page: { type: 'Alert', props: { unknown: true } } } },
    { ...valid, elements: { page: { type: 'Fragment', props: {}, children: ['page'] } } },
    { ...valid, elements: { page: { type: 'Alert', props: {}, on: { click: { action: 'missing' } } } } },
    { ...valid, elements: { page: { type: 'Alert', props: { message: { $state: 42 } } } } },
  ])('rejects malformed documents without translating retired syntax', (value) => {
    expect(checkDocument(value).valid).toBe(false)
  })
  it('checks application component and action definitions', () => {
    const catalog = defineCatalog(schema, { components: { Custom: { props: z.strictObject({ count: z.number() }), events: ['save'] } }, actions: { save: { params: z.strictObject({ id: z.number() }) } } })
    const spec = { root: 'custom', elements: { custom: { type: 'Custom', props: { count: { $state: '/count' } }, on: { save: { action: 'save', params: { id: 4 } } } } } }
    expect(checkDocument(spec, catalog).valid).toBe(true)
    expect(checkDocument({ ...spec, elements: { custom: { ...spec.elements.custom, props: { count: 'bad' } } } }, catalog).valid).toBe(false)
  })
  it('reports a component or action named like an inherited object member as unknown', () => {
    for (const name of ['constructor', 'toString', '__proto__']) {
      expect(checkDocument({ root: 'page', elements: { page: { type: name, props: {} } } }).issues).toEqual([expect.objectContaining({ code: 'unknown_component' })])
      expect(checkDocument({ root: 'page', elements: { page: { type: 'Alert', props: { message: 'Hi' }, on: { click: { action: name } } } } }).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unknown_action' })]))
    }
  })
  it('checks props and action params whose own keys look like an expression', () => {
    const catalog = defineCatalog(schema, { components: { Custom: { props: z.strictObject({ count: z.number() }), events: ['save'] } }, actions: { save: { params: z.strictObject({ id: z.number() }) } } })
    const page = (props: unknown, params: unknown): unknown => ({ root: 'custom', elements: { custom: { type: 'Custom', props, on: { save: { action: 'save', params } } } } })
    // An expression stands for one value, never for the whole props or params object.
    expect(checkDocument(page({ count: 'bad', bogus: true, $state: '/x' }, { id: 4 }), catalog).issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['/elements/custom/props/count', '/elements/custom/props']))
    expect(checkDocument(page({ count: 1 }, { id: 'bad', $state: '/x' }), catalog).valid).toBe(false)
    expect(checkDocument(page({ count: { $state: '/count' } }, { id: { $state: '/id' } }), catalog).valid).toBe(true)
  })
  it('validates manifest inline Specs and theme with the owning schemas', () => {
    expect(checkDocument({ app: { id: 'test', title: 'Test' }, routes: [{ path: '/', page: { spec: valid } }] }, defaultCatalog, { kind: 'manifest' }).valid).toBe(true)
    expect(checkDocument({ mode: 'light', primary: '#123456' }, defaultCatalog, { kind: 'theme' }).valid).toBe(true)
    expect(checkDocument({ mode: 'unexpected' }, defaultCatalog, { kind: 'theme' }).valid).toBe(false)
  })
  it('checks the prebuilt base config.json, an inline manifest\'s pages with it', () => {
    const config = { data: { url: '/api' }, panels: { manifest: { app: { id: 'a', title: 'A' }, routes: [{ path: '/', page: { spec: valid } }] } } }
    expect(checkDocument(config, defaultCatalog, { kind: 'config' })).toEqual({ valid: true, issues: [] })
    expect(checkDocument({ ...config, data: {} }, defaultCatalog, { kind: 'config' }).valid).toBe(false)
    expect(checkDocument({ ...config, panels: { ...config.panels, auth: 'missing' } }, defaultCatalog, { kind: 'config' }).valid).toBe(false)
    const broken = { ...config, panels: { manifest: { app: { id: 'a', title: 'A' }, routes: [{ path: '/', page: { spec: { root: 'x', elements: { x: { type: 'Nope', props: {} } } } } }] } } }
    expect(checkDocument(broken, defaultCatalog, { kind: 'config' }).issues[0]).toMatchObject({ code: 'unknown_component', path: expect.stringContaining('/panels/manifest/routes/') })
    expect(run(config, ['--kind', 'config']).status).toBe(0)
  })
  it('returns CLI exit codes and the same structured diagnostics', () => {
    const success = run(valid)
    expect(success.status, success.stderr).toBe(0)
    expect(JSON.parse(success.stdout)).toEqual(checkDocument(valid))
    expect(run({ root: 'missing', elements: {} }).status).toBe(1)
    expect(run(valid, ['--kind', 'unknown']).status).toBe(2)
  })
  it('lists the Catalog and describes a component from the definitions validation uses', () => {
    expect(getCatalog().components.some(component => component.name === 'Table')).toBe(true)
    expect(getCatalog().actions.some(action => action.name === 'submitForm')).toBe(true)
    expect(getCatalog(defaultCatalog, { kind: 'actions' }).components).toEqual([])
    // Params are only worked out for the one action asked for by name.
    expect(getCatalog(defaultCatalog, { kind: 'actions' }).actions[0]).not.toHaveProperty('params')
    expect(getCatalog(defaultCatalog, { name: 'submitForm' }).actions).toEqual([expect.objectContaining({ name: 'submitForm', params: expect.objectContaining({ type: 'object' }) })])
    expect(describeComponent('Button')).toMatchObject({ type: 'Button', events: ['press'], props: { type: 'object' } })
    expect(() => describeComponent('Unknown')).toThrow('Unknown component')
    expect(() => describeComponent('constructor')).toThrow('Unknown component')
    const catalog = defineCatalog(schema, { components: { Notice: { props: z.strictObject({ message: z.string() }), slots: [], events: ['dismiss'] } }, actions: {} })
    expect(describeComponent('Notice', catalog)).toMatchObject({ type: 'Notice', events: ['dismiss'] })
  })
  it('answers the catalog and describe subcommands as JSON with exit codes', () => {
    const listed = lookup(['catalog', '--kind', 'actions', '--name', 'submitForm'])
    expect(listed.status, listed.stderr).toBe(0)
    expect(JSON.parse(listed.stdout)).toEqual(JSON.parse(JSON.stringify(getCatalog(defaultCatalog, { kind: 'actions', name: 'submitForm' }))))
    expect(lookup(['catalog', '--name', 'Missing']).status).toBe(1)
    expect(lookup(['catalog', '--kind', 'pages']).status).toBe(2)
    const described = lookup(['describe', 'Table'])
    expect(described.status, described.stderr).toBe(0)
    expect(JSON.parse(described.stdout)).toEqual(JSON.parse(JSON.stringify(describeComponent('Table'))))
    const unknown = lookup(['describe', 'Missing'])
    expect(unknown.status).toBe(2)
    expect(unknown.stderr).toContain('Unknown component: Missing')
    expect(lookup(['describe']).status).toBe(2)
    expect(lookup(['--help']).stdout).toContain('lumi-check describe <Component>')
  })
})
