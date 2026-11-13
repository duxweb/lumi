import { describe, expect, it } from 'vitest'
import { docsCatalog } from '../src/docs/reference/catalog'
import { COMPONENT_LEADS, componentLead } from '../src/docs/reference/component-docs'

describe('component leads', () => {
  it('give every Catalog component a lead', () => {
    const missing = docsCatalog.components
      .map(component => component.type)
      .filter(type => !COMPONENT_LEADS[type]?.trim())
    expect(missing).toEqual([])
  })

  it('name only components that still exist', () => {
    const declared = new Set(docsCatalog.components.map(component => component.type))
    expect(Object.keys(COMPONENT_LEADS).filter(type => !declared.has(type))).toEqual([])
  })

  it('keep MDX-sensitive characters inside code spans', () => {
    const unsafe = Object.entries(COMPONENT_LEADS)
      .filter(([, lead]) => /[{}<>]/.test(lead.replace(/`[^`]*`/g, '')))
      .map(([type]) => type)
    expect(unsafe).toEqual([])
  })

  it('throw for an unknown type', () => {
    expect(componentLead('Query')).toBe(COMPONENT_LEADS.Query)
    expect(() => componentLead('NoSuchComponent')).toThrow()
  })
})
