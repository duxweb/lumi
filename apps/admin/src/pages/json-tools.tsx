import type { TableColumn } from '@duxweb/lumi-ui'
import type { DocumentValidation } from '@duxweb/lumi/catalog'
import type { Spec } from '@json-render/core'
import type { BaseComponentProps } from '@json-render/react'
import type { ReactElement } from 'react'
import type { CodeFile } from '../developer/kit.js'
import { useTranslate } from '@duxweb/lumi'
import { adminRegistry, LumiCodeExample, LumiSegmented } from '@duxweb/lumi-admin'
import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { LumiAlert as Alert, LumiBadge as Badge, LumiButton as Button, LumiCodeBlock as CodeBlock, LumiInput as Input, LumiPagination as Pagination, LumiStack as Stack, LumiTable as Table, LumiText as Text } from '@duxweb/lumi-ui'
import { uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { composeDefinitions, lumiComponentDefinitions, validateDocument } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { defineRegistry } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { Code, DeveloperPage, Editor, issueColumns, RenderBoundary, ResetButton, SpecRender } from '../developer/kit.js'
import { json, localizeSpec } from '../developer/source.js'
import { actionSpecs, brokenSpec, querySpecs, stateSpecs } from '../json-specs.js'
import { perLocale } from '../shared.js'
import { showcaseCatalog } from './json.js'

// Catalog and validation, and the Playground. Validation always runs the
// shared validateDocument against the application Catalog, as lumi-check does.

type Translate = ReturnType<typeof useTranslate>

const PAGE_SIZE = 10

function layerOf(name: string): string {
  if (name in lumiComponentDefinitions)
    return 'lumi'
  if (name in uiComponentDefinitions)
    return 'lumi-ui'
  return 'lumi-admin'
}

interface Definition { description?: string, events?: readonly string[] }

/** Definitions mark code with Markdown backticks; a table cell shows plain text. */
const plain = (text = ''): string => text.replaceAll('`', '')

const componentRows = Object.entries(adminCatalogDefinitions.components as Record<string, Definition>)
  .map(([name, definition]) => ({ id: name, name, layer: layerOf(name), description: plain(definition.description), events: (definition.events ?? []).join(', ') || '—' }))
  .sort((a, b) => a.name.localeCompare(b.name))

const actionRows = [
  ...Object.entries(adminCatalogDefinitions.actions as Record<string, Definition>).map(([name, definition]) => ({ id: name, name, source: 'lumi', description: plain(definition.description) })),
  ...(showcaseCatalog.schema.builtInActions ?? []).map(action => ({ id: action.name, name: action.name, source: 'json-render', description: plain(action.description) })),
].sort((a, b) => a.name.localeCompare(b.name))

const componentColumns = perLocale((t): TableColumn[] => ([
  { field: 'name', label: t('Component'), kind: 'code', width: '11rem' },
  { field: 'layer', label: t('Package'), width: '7rem' },
  { field: 'description', label: t('Description'), truncate: true },
  { field: 'events', label: t('Events'), width: '11rem', truncate: true },
]))

const actionColumns = perLocale((t): TableColumn[] => ([
  { field: 'name', label: t('Action'), kind: 'code', width: '11rem' },
  { field: 'source', label: t('From'), width: '7rem' },
  { field: 'description', label: t('Description'), truncate: true },
]))

const CATALOG_SOURCE: CodeFile = {
  name: 'catalog.ts',
  language: 'ts',
  code: `import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'

// Lumi services, UI and Admin definitions. The /catalog entries
// import no React, so Node tools load the same file.
export const catalog = defineCatalog(schema, adminCatalogDefinitions)

catalog.componentNames // ['Query', 'Button', 'Table', …]
catalog.actionNames // ['request', 'submitForm', 'navigate', …]`,
}

const VALIDATE_SOURCE: CodeFile = {
  name: 'validate.ts',
  language: 'ts',
  code: `import { validateDocument } from '@duxweb/lumi/catalog'
import { catalog } from './catalog'

const result = validateDocument(spec, catalog)
// { valid: false, issues: [{ path, code, message, hint, severity }] }`,
}

const CHECK_CATALOG: CodeFile = {
  name: 'catalog.mjs',
  language: 'ts',
  code: `// Optional: point lumi-check at the application Catalog,
// custom components included. Without --catalog it uses the Admin preset.
import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'

export const catalog = defineCatalog(schema, adminCatalogDefinitions)`,
}

/** The text lumi-check prints, from packages/check/src/cli.ts. */
function checkOutput(result: DocumentValidation): string {
  return result.valid
    ? 'Valid spec.'
    : result.issues.map(issue => `${issue.severity} ${issue.path || '/'} ${issue.code}: ${issue.message}`).join('\n')
}

function parse(source: string, catalog = showcaseCatalog): { result?: DocumentValidation, spec?: Spec, error?: string } {
  try {
    const value: unknown = JSON.parse(source)
    const result = validateDocument(value, catalog)
    return { result, spec: result.valid ? value as Spec : undefined }
  }
  catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

function useDebounced<T>(value: T, delay = 250): T {
  const [current, setCurrent] = useState(value)
  useEffect(() => {
    const timer = setTimeout(setCurrent, delay, value)
    return () => clearTimeout(timer)
  }, [value, delay])
  return current
}

function ValidationResult({ result, error }: { result?: DocumentValidation, error?: string }): ReactElement | null {
  const t = useTranslate()
  const issues = useMemo(() => result?.issues.map((issue, index) => ({ id: index, ...issue })) ?? [], [result])
  if (error)
    return <Alert tone="danger" title={t('Not valid JSON')} message={error} />
  if (!result)
    return null
  return (
    <>
      {result.valid
        ? <Alert tone="success" title={t('Spec is valid')} message={t('Every element, prop and action matches the Catalog')} />
        : <Alert tone="danger" title={t('{count} issues', { count: issues.length })} message={t('Each issue names the JSON path to fix, exactly as lumi-check reports it')} />}
      {issues.length > 0 && <Table rowKey="id" columns={issueColumns(t)} rows={issues} />}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* A custom component, defined once for the Catalog and once for the registry. */

const priceTagDefinition = {
  props: z.strictObject({
    amount: z.number(),
    compareAt: z.number().optional(),
    currency: z.string().length(3).optional(),
  }),
  slots: [],
  events: [],
  description: 'A price, beside the original price when on sale.',
}

const customCatalog = defineCatalog(schema, {
  components: composeDefinitions(adminCatalogDefinitions.components, { PriceTag: priceTagDefinition }),
  actions: adminCatalogDefinitions.actions,
})

function PriceTag({ props }: BaseComponentProps<z.infer<typeof priceTagDefinition.props>>): ReactElement {
  const { amount, compareAt = 0, currency = 'USD' } = props
  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency })
  const off = compareAt > amount ? Math.round((1 - amount / compareAt) * 100) : 0
  return (
    <Stack direction="horizontal" gap="sm" align="center">
      <Text text={money.format(amount)} />
      {off > 0 && <Text variant="muted" text={money.format(compareAt)} />}
      {off > 0 && <Badge tone="danger" label={`−${off}%`} />}
    </Stack>
  )
}

const { registry: priceRegistry } = defineRegistry(defineCatalog(schema, { components: { PriceTag: priceTagDefinition }, actions: {} }), { components: { PriceTag } })
const customRegistry = composeDefinitions(adminRegistry, priceRegistry)

const CUSTOM_FILES: readonly CodeFile[] = [
  {
    name: 'catalog.ts',
    language: 'ts',
    code: `import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { composeDefinitions } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

export const priceTag = {
  props: z.strictObject({
    amount: z.number(),
    compareAt: z.number().optional(),
    currency: z.string().length(3).optional(),
  }),
  slots: [],
  events: [],
  description: 'A price, beside the original price when on sale.',
}

// Throws on a name clash instead of replacing silently.
const components = composeDefinitions(
  adminCatalogDefinitions.components,
  { PriceTag: priceTag },
)
export const catalog = defineCatalog(schema, {
  components,
  actions: adminCatalogDefinitions.actions,
})`,
  },
  {
    name: 'registry.tsx',
    language: 'tsx',
    code: `import { adminRegistry } from '@duxweb/lumi-admin'
import { LumiBadge, LumiStack, LumiText } from '@duxweb/lumi-ui'
import { composeDefinitions } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { defineRegistry } from '@json-render/react'
import { schema } from '@json-render/react/schema'
import { priceTag } from './catalog'

function PriceTag({ props }) {
  const { amount, compareAt = 0, currency = 'USD' } = props
  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency })
  const off = compareAt > amount ? Math.round((1 - amount / compareAt) * 100) : 0
  return (
    <LumiStack direction="horizontal" gap="sm" align="center">
      <LumiText text={money.format(amount)} />
      {off > 0 && <LumiText variant="muted" text={money.format(compareAt)} />}
      {off > 0 && <LumiBadge tone="danger" label={\`−\${off}%\`} />}
    </LumiStack>
  )
}

const { registry: prices } = defineRegistry(
  defineCatalog(schema, { components: { PriceTag: priceTag }, actions: {} }),
  { components: { PriceTag } },
)
export const registry = composeDefinitions(adminRegistry, prices)`,
  },
]

const customSpec = {
  root: 'card',
  elements: {
    card: { type: 'Card', props: { title: { $t: 'Linen throw' }, description: { $t: 'Rendered by a component the application registered.' } }, children: ['price'] },
    price: { type: 'PriceTag', props: { amount: 48, compareAt: 64, currency: 'USD' }, children: [] },
  },
} satisfies Spec

/* -------------------------------------------------------------------------- */

export function AdminJsonCatalogRoute(): ReactElement {
  const t = useTranslate()
  const [view, setView] = useState<'components' | 'actions'>('components')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const components = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? componentRows.filter(row => `${row.name} ${row.description}`.toLowerCase().includes(needle)) : componentRows
  }, [query])
  const [source, setSource] = useState(() => json(brokenSpec))
  const debounced = useDebounced(source)
  const checked = useMemo(() => parse(debounced), [debounced])
  const cliResult = useMemo(() => validateDocument(brokenSpec, showcaseCatalog), [])
  const custom = useMemo(() => localizeSpec(customSpec, t), [t])
  const customResult = useMemo(() => validateDocument(custom, customCatalog), [custom])
  return (
    <DeveloperPage title={t('Catalog validation')} description={t('One Catalog validates Specs in the renderer, lumi-check and the server')}>
      <LumiCodeExample
        title={t('Assemble the Catalog')}
        layout="stack"
        code={<Code files={[CATALOG_SOURCE, VALIDATE_SOURCE]} />}
        previewLabel={t('Result')}
        preview={(
          <>
            <Stack direction="horizontal" gap="sm" align="center" justify="between" wrap>
              <LumiSegmented ariaLabel={t('Catalog section')} value={view} onChange={value => setView(value as 'components' | 'actions')} options={[{ value: 'components', label: t('Components') }, { value: 'actions', label: t('Actions') }]} />
              {view === 'components' && (
                <Input
                  ariaLabel={t('Search components')}
                  placeholder={t('Search components')}
                  value={query}
                  onChange={(value) => {
                    setQuery(String(value ?? ''))
                    setPage(1)
                  }}
                />
              )}
            </Stack>
            {view === 'components'
              ? <Table rowKey="id" columns={componentColumns(t)} rows={components.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} empty={t('No components match')} />
              : <Table rowKey="id" columns={actionColumns(t)} rows={actionRows} />}
            {view === 'components' && components.length > PAGE_SIZE && <Pagination ariaLabel={t('Components pages')} page={page} pageSize={PAGE_SIZE} total={components.length} onPageChange={setPage} />}
          </>
        )}
      />
      <LumiCodeExample
        title={t('Validate a Spec')}
        codeLabel="page.json"
        code={<Editor label={t('Spec JSON')} value={source} onChange={setSource} />}
        previewLabel={t('Issues')}
        previewActions={(
          <>
            <Button label={t('Load valid sample')} appearance="ghost" size="sm" onClick={() => setSource(json(localizeSpec(stateSpecs.bind, t)))} />
            <Button label={t('Load broken sample')} appearance="ghost" size="sm" onClick={() => setSource(json(brokenSpec))} />
          </>
        )}
        preview={<ValidationResult result={checked.result} error={checked.error} />}
      />
      <LumiCodeExample
        title={t('lumi-check in CI')}
        code={(
          <Code files={[
            { name: 'terminal', language: 'bash', code: 'npx lumi-check pages/broken.json --catalog ./catalog.mjs\necho $? # 1' },
            CHECK_CATALOG,
            { name: 'pages/broken.json', language: 'json', code: json(brokenSpec) },
          ]}
          />
        )}
        previewLabel={t('Output')}
        preview={<CodeBlock title="stdout" code={checkOutput(cliResult)} wrap data-testid="check-output" />}
      />
      <LumiCodeExample
        title={t('Custom components')}
        code={<Code files={[...CUSTOM_FILES, { name: 'page.json', language: 'json', code: json(custom) }]} />}
        previewLabel={t('Result')}
        previewActions={<Badge tone={customResult.valid ? 'success' : 'danger'} label={customResult.valid ? t('Valid against the extended Catalog') : t('Invalid')} />}
        preview={<SpecRender spec={custom} registry={customRegistry} />}
      />
    </DeveloperPage>
  )
}

/* -------------------------------------------------------------------------- */

const SAMPLES = perLocale((t: Translate) => ({
  form: { label: t('Form'), spec: localizeSpec(actionSpecs.submit, t) },
  list: { label: t('List'), spec: localizeSpec(querySpecs.list, t) },
  cascade: { label: t('Cascade'), spec: localizeSpec(stateSpecs.watch, t) },
  broken: { label: t('Broken'), spec: brokenSpec },
}))

type SampleName = keyof ReturnType<typeof SAMPLES>

export function AdminJsonPlaygroundRoute(): ReactElement {
  const t = useTranslate()
  const samples = SAMPLES(t)
  const [sample, setSample] = useState<SampleName>('form')
  const [source, setSource] = useState(() => json(samples.form.spec))
  const [revision, setRevision] = useState(0)
  const debounced = useDebounced(source)
  const checked = useMemo(() => parse(debounced), [debounced])
  // The last Spec that validated keeps rendering while the source is mid-edit.
  const [rendered, setRendered] = useState<Spec | undefined>(checked.spec)
  useEffect(() => {
    if (checked.spec)
      setRendered(checked.spec)
  }, [checked.spec])
  const stateKey = useMemo(() => JSON.stringify(rendered?.state ?? null), [rendered])
  const load = (name: SampleName): void => {
    setSample(name)
    setSource(json(samples[name].spec))
    setRevision(value => value + 1)
  }
  return (
    <DeveloperPage title={t('Playground')} description={t('Edit a Spec and see it render, validated as you type')}>
      <LumiCodeExample
        title={t('Spec editor')}
        actions={<LumiSegmented ariaLabel={t('Sample')} value={sample} onChange={value => load(value as SampleName)} options={(Object.keys(samples) as SampleName[]).map(name => ({ value: name, label: samples[name].label }))} />}
        codeLabel="page.json"
        code={<Editor label={t('Spec JSON')} value={source} onChange={setSource} minHeight={600} maxHeight={760} />}
        previewLabel={t('Result')}
        previewActions={(
          <>
            <Badge tone={checked.spec ? 'success' : 'danger'} label={checked.spec ? t('Valid') : checked.error ? t('Not valid JSON') : t('{count} issues', { count: checked.result?.issues.length ?? 0 })} />
            <ResetButton title={t('Spec editor')} onReset={() => setRevision(value => value + 1)} />
          </>
        )}
        preview={(
          <>
            {!checked.spec && <ValidationResult result={checked.result} error={checked.error} />}
            {rendered && (
              <RenderBoundary resetKey={rendered} fallback={error => <Alert tone="danger" title={t('The Spec failed while rendering')} message={error.message} />}>
                <SpecRender key={`${revision}:${stateKey}`} spec={rendered} showState />
              </RenderBoundary>
            )}
          </>
        )}
      />
    </DeveloperPage>
  )
}
