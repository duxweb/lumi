// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import { createLumi } from '@duxweb/lumi'
import { defineCatalog } from '@json-render/core'
import { defineRegistry } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { LumiSpecPage } from '../../src/react/index'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const catalog = defineCatalog(schema, {
  components: { Label: { props: z.strictObject({ text: z.string() }), description: 'Shows text.' } },
  actions: {},
})
const { registry } = defineRegistry(catalog, {
  components: { Label: ({ props }) => <p data-testid="label">{props.text}</p> },
})

const spec = {
  root: 'total',
  state: { price: 12, count: 3 },
  elements: {
    total: {
      type: 'Label',
      props: { text: { $computed: 'total', args: { price: { $state: '/price' }, count: { $state: '/count' } } } },
      children: [],
    },
  },
} as unknown as Spec

async function render(functions?: Record<string, (args: Record<string, unknown>) => unknown>): Promise<string | null | undefined> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(<LumiSpecPage context={createLumi()} catalog={catalog} registry={registry} spec={spec} functions={functions} agent={false} />)
  })
  const text = host.querySelector('[data-testid="label"]')?.textContent
  await act(async () => root.unmount())
  host.remove()
  return text
}

describe('$computed in a page', () => {
  it('calls the function registered under its name with the resolved args', async () => {
    expect(await render({ total: args => `¥${Number(args.price) * Number(args.count)}` })).toBe('¥36')
  })
})
