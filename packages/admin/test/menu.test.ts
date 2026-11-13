import type { AdminManifest } from '../src/catalog.js'
import { describe, expect, it } from 'vitest'
import { createAdminMenu, filterAdminMenuByAccess, flattenAdminRoutes } from '../src/catalog.js'

const manifest: AdminManifest = {
  app: { id: 'menu', title: 'Menu' },
  routes: [
    { name: 'home', path: '/', menu: { label: 'Home' } },
    {
      name: 'system',
      path: '/system',
      access: { resource: 'system' },
      children: [
        // Guarded at runtime by its parent's check, so its menu item is too.
        { name: 'users', path: 'users', menu: { label: 'Users' } },
        { name: 'roles', path: 'roles', access: { resource: 'roles', action: 'manage' }, menu: { label: 'Roles' } },
      ],
    },
  ],
}

describe('admin menu access', () => {
  it('gives a route without its own access the nearest ancestor\'s', () => {
    const byName = Object.fromEntries(flattenAdminRoutes(manifest.routes).map(entry => [entry.route.name, entry.access]))
    expect(byName).toEqual({ home: undefined, system: { resource: 'system' }, users: { resource: 'system' }, roles: { resource: 'roles', action: 'manage' } })
    expect(createAdminMenu(manifest).map(item => [item.name, item.resource, item.action])).toEqual([
      ['home', undefined, undefined],
      ['users', 'system', undefined],
      ['roles', 'roles', 'manage'],
    ])
  })

  it('hides the child of a refused parent from the menu', async () => {
    const accessProvider = { can: async ({ resource }: { resource: string }) => ({ can: resource !== 'system' }) }
    const visible = await filterAdminMenuByAccess({ accessProvider }, createAdminMenu(manifest))
    expect(visible.map(item => item.name)).toEqual(['home', 'roles'])
  })
})
