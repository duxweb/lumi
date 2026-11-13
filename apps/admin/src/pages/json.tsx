import type { Spec } from '@json-render/core'
import type { ReactElement } from 'react'
import { LumiProvider, useLumi, useTranslate } from '@duxweb/lumi'
import { adminRegistry } from '@duxweb/lumi-admin'
import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { LumiCard as Card, LumiCodeBlock as CodeBlock } from '@duxweb/lumi-ui'
import { defineCatalog } from '@json-render/core'
import { Renderer } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { useQueryClient } from '@tanstack/react-query'

// Shared by the showcase pages; the Developer pages live in json-guide.tsx and json-tools.tsx.

// adminRegistry = Lumi services + UI + charts + Admin pages, with Upload connected to the upload service.
export const showcaseRegistry = adminRegistry
const registry = showcaseRegistry
export const showcaseCatalog = defineCatalog(schema, adminCatalogDefinitions)

/** Collapsible source for a JSON document, shared by the showcase pages. */
export function JsonSource({ label, value }: { label?: string, value: unknown }): ReactElement {
  const t = useTranslate()
  return (
    <CodeBlock collapsible title={label ?? t('View native Spec')} language="json" code={typeof value === 'string' ? value : JSON.stringify(value, null, 2)} />
  )
}

/** Renders a native Spec in its own StateStore, followed by its exact source. */
export function SpecPreview({ spec, revision = 0 }: { spec: Spec, revision?: number }): ReactElement {
  const t = useTranslate()
  const context = useLumi()
  const queryClient = useQueryClient()
  return (
    <>
      <LumiProvider key={revision} context={context} queryClient={queryClient} registry={registry} initialState={spec.state}>
        <Renderer spec={spec} registry={registry} />
      </LumiProvider>
      <Card title={t('Native Spec')} description={t('The JSON above is rendered exactly as shown; no page code is involved')}>
        <JsonSource value={spec} />
      </Card>
    </>
  )
}
