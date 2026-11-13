import { describe, expect, it } from 'vitest'
import { docsCatalog } from '../src/docs/reference/catalog'
import { COMMON_PROPS, COMPONENT_PROPS, propDoc } from '../src/docs/reference/prop-docs'

describe('component parameter docs', () => {
  it('explain every prop the Catalog declares', () => {
    const missing = docsCatalog.components.flatMap(component => component.props
      .filter(prop => !propDoc(component.type, prop.name)?.text)
      .map(prop => `${component.type}.${prop.name}`))
    expect(missing).toEqual([])
  })

  it('name only props that still exist', () => {
    const declared = new Map(docsCatalog.components.map(component => [component.type, new Set(component.props.map(prop => prop.name))]))
    const all = new Set(docsCatalog.components.flatMap(component => component.props.map(prop => prop.name)))
    const stale = Object.entries(COMPONENT_PROPS).flatMap(([type, props]) => Object.keys(props)
      .filter(prop => !declared.get(type)?.has(prop))
      .map(prop => `${type}.${prop}`))
    expect(stale).toEqual([])
    expect(Object.keys(COMMON_PROPS).filter(prop => !all.has(prop))).toEqual([])
  })
})
