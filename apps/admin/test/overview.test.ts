import type { Spec } from '@json-render/core'
import { readFileSync } from 'node:fs'
import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { COMPONENT_OVERVIEW } from '@duxweb/lumi-schema-gallery'
import { validateDocument } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { describe, expect, it } from 'vitest'
import { CAPABILITIES, HIDDEN_ROUTES, LINKED_CAPABILITIES } from '../src/capabilities.js'

const catalog = defineCatalog(schema, adminCatalogDefinitions)
// Not drawn on their own: the data and agent connectors, the row template inside Repeater,
// Include (another page in its place), Iframe (another site, not loaded in a thumbnail), and the agent workspace, a whole page with its own
// route that talks to a live endpoint.
const NOT_SHOWN = new Set(['Query', 'CanAccess', 'AssistantContext', 'AgentSession', 'AgentWorkspace', 'RepeaterRow', 'Include', 'Iframe'])
// Read a live resource, so their thumbnails draw the parts they render, from static rows.
const DRAWN_FROM_PARTS = new Set(['ListPage', 'AuditLog'])

function page(file: string): Spec {
  return JSON.parse(readFileSync(new URL(`../public/pages/${file}`, import.meta.url), 'utf8')) as Spec
}

/** The menu entry, linked page or hidden route that a showcase path opens. */
function routeOf(path: string): { spec?: string, group?: string } | undefined {
  const capability = CAPABILITIES.find(item => item.path === path)
  if (capability)
    return { spec: capability.spec, group: capability.group.name }
  if (LINKED_CAPABILITIES.some(item => item.href === path))
    return {}
  const hidden = HIDDEN_ROUTES.find(item => new RegExp(`^${item.path.replace(/:[^/]+/g, '[^/]+')}$`).test(path))
  return hidden ? {} : undefined
}

describe('component overview', () => {
  it('draws every visual Catalog component once from a valid native Spec', () => {
    const names = COMPONENT_OVERVIEW.components.map(entry => entry.name)
    expect(new Set(names).size).toBe(names.length)
    expect(catalog.componentNames.filter(name => !NOT_SHOWN.has(name) && !names.includes(name))).toEqual([])
    for (const entry of COMPONENT_OVERVIEW.components) {
      expect(catalog.componentNames, entry.name).toContain(entry.name)
      expect(validateDocument(entry.spec, catalog), entry.name).toEqual({ valid: true, issues: [] })
      // A FormField draws its widget, so `widget: "Textarea"` is a real Textarea.
      if (!DRAWN_FROM_PARTS.has(entry.name))
        expect(Object.values(entry.spec.elements).some(element => element.type === entry.name || (element.type === 'FormField' && element.props.widget === entry.name)), `${entry.name} thumbnail renders the component`).toBe(true)
      expect(COMPONENT_OVERVIEW.categories.map(category => category.name), entry.name).toContain(entry.category)
    }
  })

  it('opens each component at its one demo section, in its own menu group', () => {
    for (const entry of COMPONENT_OVERVIEW.components) {
      const [path, anchor] = entry.href.split('#') as [string, string | undefined]
      const route = routeOf(path)
      expect(route, `${entry.name} opens ${entry.href}`).toBeDefined()
      if (route?.group && COMPONENT_OVERVIEW.categories.some(category => category.name === route.group))
        expect(entry.category, `${entry.name} sits in the group of ${path}`).toBe(route.group)
      if (anchor) {
        expect(route?.spec, `${entry.href} anchors into a JSON page`).toBeDefined()
        const examples = Object.values(page(route!.spec!).elements).filter(element => element.type === 'Example')
        expect(examples.map(element => element.props.id), `${entry.href} names an Example`).toContain(anchor)
      }
    }
  })

  it('gives every example on a showcase page a unique anchor', () => {
    for (const capability of CAPABILITIES.filter(item => item.spec)) {
      const ids = Object.values(page(capability.spec!).elements).filter(element => element.type === 'Example').map(element => element.props.id)
      expect(new Set(ids).size, capability.spec).toBe(ids.length)
    }
  })
})
