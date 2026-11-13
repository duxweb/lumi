import { describe, expect, it } from 'vitest'
import { ACTION_DOCS, ACTION_PARAM_OVERRIDES, ACTION_PARAMS } from '../src/docs/reference/action-docs'
import { actionParamSchemas, docsCatalog } from '../src/docs/reference/catalog'

const paramsOf = (name: string): string[] => Object.keys(actionParamSchemas[name]?.properties ?? {})

describe('action reference text', () => {
  it('explains every action of the Catalog, and none that is gone', () => {
    expect(Object.keys(ACTION_DOCS).sort()).toEqual([...docsCatalog.actions].sort())
    for (const name of docsCatalog.actions)
      expect(ACTION_DOCS[name]!.lead, name).not.toBe('')
  })

  it('explains every param of every action', () => {
    const missing = docsCatalog.actions.flatMap(name => paramsOf(name)
      .filter(param => !(ACTION_PARAM_OVERRIDES[name]?.[param] ?? ACTION_PARAMS[param]))
      .map(param => `${name}.${param}`))
    expect(missing).toEqual([])
  })

  it('keeps no explanation of a param the Catalog no longer has', () => {
    const known = new Set(docsCatalog.actions.flatMap(paramsOf))
    expect(Object.keys(ACTION_PARAMS).filter(param => !known.has(param))).toEqual([])
    const stale = Object.entries(ACTION_PARAM_OVERRIDES).flatMap(([name, overrides]) => Object.keys(overrides)
      .filter(param => !paramsOf(name).includes(param))
      .map(param => `${name}.${param}`))
    expect(stale).toEqual([])
  })

  it('shows each action in its own examples, with notes only on params the example uses', () => {
    for (const [name, doc] of Object.entries(ACTION_DOCS)) {
      for (const example of doc.examples) {
        expect(example.binding.action, name).toBe(name)
        expect(Object.keys(example.notes ?? {}).filter(param => !(param in example.binding.params)), name).toEqual([])
        // An example is bound on a button with a label, or on the element the action belongs to.
        expect(Boolean(example.label) !== Boolean(example.host), name).toBe(true)
      }
      // Several examples are told apart by their headings.
      if (doc.examples.length > 1)
        expect(doc.examples.every(example => Boolean(example.title)), name).toBe(true)
    }
  })
})
