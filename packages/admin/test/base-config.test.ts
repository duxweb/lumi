import { describe, expect, it } from 'vitest'
import { adminBaseConfigSchema, selectAdminPanel } from '../src/catalog.js'
import { resolveAdminBaseConfig } from '../src/react/mountAdmin.js'

const manifest = { app: { id: 'shop' }, routes: [] }

describe('admin base config', () => {
  it('accepts one of each as plain objects, inline and remote', () => {
    const config = {
      data: { url: '/api', live: '/events' },
      auth: { mode: 'bearer', endpoints: { me: '/whoami' } },
      access: { separator: '.' },
      panels: {
        manifest: '/manifest.json',
        menuBadges: { orders: { label: 11, tone: 'warning' } },
        login: {
          features: [{ icon: 'shield', title: 'One base script', description: 'Every page from JSON' }],
          demo: { username: 'admin', password: 'admin' },
          forgotPassword: { href: '/reset' },
          links: [{ label: 'Privacy', href: '/privacy' }],
        },
      },
      theme: { mode: 'dark' },
      i18n: { locale: 'zh-CN', translations: { 'zh-CN': '/locales/zh-CN.json', 'en-US': { 'menu.home': 'Home' } } },
    }
    expect(adminBaseConfigSchema.parse(config)).toEqual(config)
  })

  it('reads data, auth, access and panels the same way: one object, or a list of named items', () => {
    const base = { data: { url: '/api' }, panels: { manifest: '/m.json' } }
    const items = { data: { url: '/api' }, auth: { mode: 'cookie' }, access: { separator: '.' }, panels: { manifest: '/m.json' } }
    const valid = (config: unknown): boolean => adminBaseConfigSchema.safeParse(config).success
    for (const [key, item] of Object.entries(items)) {
      // One object, named `default` or by its own name.
      expect(valid({ ...base, [key]: item }), key).toBe(true)
      expect(valid({ ...base, [key]: { ...item, name: 'main' } }), key).toBe(true)
      // A list: every item named, no name twice, never empty.
      expect(valid({ ...base, [key]: [{ ...item, name: 'a' }, { ...item, name: 'b', ...(key === 'panels' ? { path: '/b' } : {}) }] }), key).toBe(true)
      expect(valid({ ...base, [key]: [item] }), key).toBe(false)
      expect(valid({ ...base, [key]: [{ ...item, name: 'a' }, { ...item, name: 'a', ...(key === 'panels' ? { path: '/b' } : {}) }] }), key).toBe(false)
      expect(valid({ ...base, [key]: [] }), key).toBe(false)
    }
  })

  it('names every item of a list, and checks names, references and paths', () => {
    const base = { data: { url: '/api' }, panels: { manifest: '/m.json' } }
    expect(adminBaseConfigSchema.safeParse({ ...base, data: [{ url: '/api' }] }).success).toBe(false)
    const twice = adminBaseConfigSchema.safeParse({ ...base, data: [{ name: 'a', url: '/a' }, { name: 'a', url: '/b' }] })
    expect(twice.error?.issues[0]?.message).toBe('two data entries are named "a"')
    expect(adminBaseConfigSchema.safeParse({ ...base, panels: { manifest: '/m.json', auth: 'staff' } }).error?.issues[0]?.message).toBe('no auth entry is named "staff"')
    expect(adminBaseConfigSchema.safeParse({ ...base, panels: [{ name: 'a', manifest: '/m.json', path: '/x' }, { name: 'b', manifest: '/m.json', path: '/x' }] }).error?.issues[0]?.message).toBe('two panels live at /x')
    expect(adminBaseConfigSchema.safeParse({ ...base, panels: { manifest: '/m.json', path: '/admin/' } }).success).toBe(false)
    expect(adminBaseConfigSchema.safeParse({ ...base, defaultPanel: 'nope' }).success).toBe(false)
    // A basename is a path: without the slash the router could never match it.
    for (const basename of ['', '/', '/console', '/a/b'])
      expect(adminBaseConfigSchema.safeParse({ ...base, basename }).success, basename).toBe(true)
    for (const basename of ['console', '/console?x=1', '/console#top', '/con sole'])
      expect(adminBaseConfigSchema.safeParse({ ...base, basename }).success, basename).toBe(false)
    expect(adminBaseConfigSchema.safeParse({ ...base, access: { format: '{action}' } }).success).toBe(false)
  })

  it('names the offending path when the config is wrong', async () => {
    await expect(resolveAdminBaseConfig({ data: {}, panels: { manifest: '/m.json' }, extra: true })).rejects.toThrow(/data.*url|extra/)
  })
})

describe('admin panels', () => {
  const config = adminBaseConfigSchema.parse({
    basename: '/console',
    data: [{ name: 'main', url: '/api' }, { name: 'cms', url: '/cms', auth: false }],
    auth: [{ name: 'staff' }, { name: 'merchant', mode: 'cookie', data: 'main' }],
    access: { separator: '.' },
    panels: [
      { name: 'admin', path: '/admin', manifest, auth: 'staff' },
      { name: 'merchant', path: '/merchant', manifest, auth: 'merchant', data: 'cms' },
      { name: 'reports', path: '/merchant/reports', manifest },
    ],
    defaultPanel: 'merchant',
  })

  it('follows the address, the longest path first, under basename', () => {
    expect(selectAdminPanel(config, '/console/admin/orders').panel.name).toBe('admin')
    expect(selectAdminPanel(config, '/console/merchant').panel.name).toBe('merchant')
    expect(selectAdminPanel(config, '/console/merchant/reports/daily').panel.name).toBe('reports')
    expect(selectAdminPanel(config, '/console/merchant-old').panel.name).toBe('merchant')
  })

  it('opens the default panel elsewhere, the first without one, and a named one on its own page', () => {
    expect(selectAdminPanel(config, '/console/').basename).toBe('/console/merchant')
    expect(selectAdminPanel({ ...config, defaultPanel: undefined }, '/').panel.name).toBe('admin')
    expect(selectAdminPanel(config, '/console/admin', 'reports').panel.name).toBe('reports')
    expect(() => selectAdminPanel(config, '/', 'nope')).toThrow(/no panel is named "nope"/)
  })

  it('hands the panel its backend, sign-in and rule, the first or `default` when it names none', () => {
    const merchant = selectAdminPanel(config, '/console/merchant')
    expect(merchant.defaultData.name).toBe('cms')
    expect(merchant.auth).toMatchObject({ name: 'merchant', mode: 'cookie', data: 'main' })
    expect(merchant.access).toEqual({ name: 'default', separator: '.' })
    const reports = selectAdminPanel(config, '/console/merchant/reports')
    expect(reports.defaultData.name).toBe('main')
    expect(reports.auth.name).toBe('staff')
    const plain = selectAdminPanel(adminBaseConfigSchema.parse({ data: { url: '/api' }, panels: { manifest } }), '/anything')
    expect(plain).toMatchObject({ basename: '', auth: { name: 'default' }, access: { name: 'default' }, defaultData: { name: 'default', url: '/api' } })
  })
})

describe('admin base config urls', () => {
  it('resolves a fetched config against its own location', async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify({
      data: [{ name: 'main', url: '../api' }, { name: 'reports', url: '../reports/' }, { name: 'public', url: 'https://cdn.test/v1' }],
      panels: [{ name: 'a', manifest: 'manifest.json', theme: 'theme.json' }, { name: 'b', path: '/b', manifest }],
      theme: 'base-theme.json',
      modules: ['ext/a.js'],
      i18n: { locale: 'zh-CN', translations: { 'zh-CN': 'locales/zh-CN.json', 'en-US': { a: 'A' } } },
    }))) as typeof fetch
    try {
      const config = await resolveAdminBaseConfig('https://site.test/admin/config.json')
      expect(config.data).toEqual([{ name: 'main', url: 'https://site.test/api' }, { name: 'reports', url: 'https://site.test/reports/' }, { name: 'public', url: 'https://cdn.test/v1' }])
      expect(config.panels).toMatchObject([{ manifest: 'https://site.test/admin/manifest.json', theme: 'https://site.test/admin/theme.json' }, { manifest }])
      expect(config.theme).toBe('https://site.test/admin/base-theme.json')
      expect(config.modules).toEqual(['https://site.test/admin/ext/a.js'])
      expect(config.i18n?.translations).toEqual({ 'zh-CN': 'https://site.test/admin/locales/zh-CN.json', 'en-US': { a: 'A' } })
      const origin = await resolveAdminBaseConfig('https://site.test/admin/config.json', loaded => ({ ...loaded, data: { url: 'http://127.0.0.1:3002' } }))
      expect(origin.data).toEqual({ url: 'http://127.0.0.1:3002' })
    }
    finally {
      globalThis.fetch = original
    }
  })
})
