import type { TableColumn } from '@duxweb/lumi-ui'
import type { CatalogDefinitions } from '@duxweb/lumi/catalog'
import type { Catalog, Spec } from '@json-render/core'
import type { ReactElement } from 'react'
import type { CodeFile } from '../developer/kit.js'
import { useTranslate } from '@duxweb/lumi'
import { LumiCodeExample, LumiSegmented, useShell } from '@duxweb/lumi-admin'
import { LumiAlert as Alert, LumiButton as Button, LumiCodeBlock as CodeBlock, LumiDescriptionList as DescriptionList, LumiSelect as Select, LumiTable as Table } from '@duxweb/lumi-ui'
import { translateDirective, validateDocument } from '@duxweb/lumi/catalog'
import { useMemo, useState } from 'react'
import { z } from 'zod'
import { Code, DeveloperPage, Editor, issueColumns, SpecRender } from '../developer/kit.js'
import { json, localizeSpec } from '../developer/source.js'
import { agentSpec, brokenSpec } from '../json-specs.js'
import { perLocale } from '../shared.js'
import { showcaseCatalog } from './json.js'

// AI integration: the Shell's assistant slot, model output checked against the
// Catalog, and the lumi-check author commands answered in the browser from the same Catalog.

const HOST_FILES: readonly CodeFile[] = [
  {
    name: 'main.tsx',
    language: 'tsx',
    code: `import { mountAdmin } from '@duxweb/lumi-admin'
import { MyAssistant } from './assistant'

await mountAdmin(config, {
  // Any React node. The Shell renders it beside the page and
  // keeps the page mounted while the panel opens and closes.
  assistant: <MyAssistant />,
  assistantDefaultOpen: false,
})`,
  },
  {
    name: 'assistant.tsx',
    language: 'tsx',
    code: `import { LumiAgentPanel, useAgentConversation } from '@duxweb/lumi-admin'

// The ready-made panel: conversations from the agent-sessions resource, a
// streamed thread, and the page being viewed sent as context while shared.
export function MyAssistant() {
  return <LumiAgentPanel endpoint="/agent/chat" title="Agent" />
}

// Or your own layout over the same hook: its parts spread onto Lumi UI.
export function MyChat() {
  const conversation = useAgentConversation({ endpoint: '/agent/chat' })
  return (
    <>
      <AgentSessionList {...conversation.sessions} />
      <ChatThread {...conversation.thread} />
      <PromptInput {...conversation.prompt} />
    </>
  )
}`,
  },
]

function ShellSlotExample(): ReactElement {
  const t = useTranslate()
  const shell = useShell()
  return (
    <LumiCodeExample
      title={t('Host an assistant in the Shell')}
      code={<Code files={HOST_FILES} />}
      previewLabel={t('This Shell')}
      align="center"
      preview={(
        <>
          <DescriptionList
            items={[
              { label: 'assistant.available', value: String(shell.assistant.available) },
              { label: 'assistant.open', value: String(shell.assistant.open) },
              { label: 'active.item.label', value: shell.active.item?.label ?? '—' },
            ]}
          />
          {shell.assistant.available && <Button label={shell.assistant.open ? t('Close Agent panel') : t('Open Agent panel')} appearance="outline" onClick={shell.assistant.toggle} />}
        </>
      )}
    />
  )
}

/** The same answer with the mistakes models typically make: an invented component, action and prop. */
const hallucinatedSpec = {
  ...agentSpec,
  elements: {
    ...agentSpec.elements,
    threshold: { ...agentSpec.elements.threshold, props: { ...agentSpec.elements.threshold!.props, format: 'currency' } },
    table: { ...agentSpec.elements.table, type: 'SmartTable' },
    refresh: { ...agentSpec.elements.refresh, on: { press: { action: 'orders.remind', params: { all: true } } } },
  },
} as Spec

const OUTPUTS = { valid: agentSpec, hallucinated: hallucinatedSpec } as const

const RENDER_SOURCE: CodeFile = {
  name: 'answer.ts',
  language: 'ts',
  code: `import { validateDocument } from '@duxweb/lumi/catalog'

const result = validateDocument(answer, catalog)
if (result.valid)
  show(answer) // <LumiSpecPage spec={answer} … />
else
  ask(model, \`Fix these issues and return the whole Spec:
\${result.issues.map(issue => \`\${issue.path}: \${issue.message}\`).join('\\n')}\`)`,
}

function ModelOutputExample(): ReactElement {
  const t = useTranslate()
  const [output, setOutput] = useState<keyof typeof OUTPUTS>('valid')
  const [revision, setRevision] = useState(0)
  const spec = useMemo(() => localizeSpec(OUTPUTS[output], t), [output, t])
  const result = useMemo(() => validateDocument(spec, showcaseCatalog), [spec])
  const issues = result.issues.map((issue, index) => ({ id: index, ...issue }))
  return (
    <LumiCodeExample
      title={t('Check model output before it renders')}
      actions={(
        <LumiSegmented
          ariaLabel={t('Model output')}
          value={output}
          onChange={(value) => {
            setOutput(value as keyof typeof OUTPUTS)
            setRevision(next => next + 1)
          }}
          options={[{ value: 'valid', label: t('Valid answer') }, { value: 'hallucinated', label: t('Hallucinated answer') }]}
        />
      )}
      code={<Code files={[{ name: 'answer.json', language: 'json', code: json(spec) }, RENDER_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <>
          {result.valid
            ? <Alert tone="success" title={t('Validated')} message={t('Every component, prop and action exists in the Catalog, so the page renders')} />
            : <Alert tone="danger" title={t('Rejected before rendering')} message={issues.length === 1 ? t('1 issue. Send it back to the model as the repair prompt') : t('{count} issues. Send them back to the model as the repair prompt', { count: issues.length })} />}
          {result.valid
            ? <SpecRender spec={spec} revision={revision} />
            : <Table rowKey="id" columns={issueColumns(t)} rows={issues} />}
        </>
      )}
    />
  )
}

const PROMPT_SOURCE: CodeFile = {
  name: 'prompt.ts',
  language: 'ts',
  code: `import { translateDirective } from '@duxweb/lumi/catalog'
import { catalog } from './catalog'

// The upstream generator: every component's props, events and
// slots, every action and the Spec format, from one definition.
const system = catalog.prompt({
  customRules: [
    'Read data with Query and write it with the registered actions.',
  ],
  directives: [translateDirective],
})`,
}

function PromptExample(): ReactElement {
  const t = useTranslate()
  const prompt = useMemo(() => showcaseCatalog.prompt({ customRules: ['Read data with Query and write it with the registered actions.'], directives: [translateDirective] }), [])
  return (
    <LumiCodeExample
      title={t('A system prompt from the Catalog')}
      code={<Code files={[PROMPT_SOURCE]} />}
      previewLabel={t('{count} characters', { count: prompt.length.toLocaleString() })}
      preview={<CodeBlock title={t('System prompt')} code={prompt} wrap data-testid="system-prompt" />}
    />
  )
}

export function AdminAgentRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Agent panel')} description={t('The Shell assistant, and agent-built pages checked against the Catalog')}>
      <ShellSlotExample />
      <ModelOutputExample />
      <PromptExample />
    </DeveloperPage>
  )
}

/* -------------------------------------------------------------------------- */

// Mirrors getCatalog and describeComponent in packages/check/src/index.ts; that
// package runs on Node, so the browser computes the same output here.
function getCatalog(catalog: Catalog, options: { kind?: 'components' | 'actions', name?: string } = {}): unknown {
  const definitions = catalog.data as CatalogDefinitions
  const components = options.kind === 'actions'
    ? []
    : Object.entries(definitions.components).filter(([name]) => !options.name || name === options.name).map(([name, definition]) => ({ name, description: definition.description ?? '', slots: definition.slots ?? [], events: definition.events ?? [] }))
  const actions = options.kind === 'components'
    ? []
    : Object.entries(definitions.actions ?? {}).filter(([name]) => !options.name || name === options.name).map(([name, definition]) => ({ name, description: definition.description ?? '', ...(options.name ? { params: z.toJSONSchema(definition.params, { unrepresentable: 'any' }) } : {}) }))
  return { components, actions, builtInActions: catalog.schema.builtInActions ?? [] }
}

function describeComponent(type: string, catalog: Catalog): unknown {
  const definition = (catalog.data as CatalogDefinitions).components[type]!
  return { type, description: definition.description ?? '', props: z.toJSONSchema(definition.props, { unrepresentable: 'any' }), slots: definition.slots ?? [], events: definition.events ?? [] }
}

const commandColumns = perLocale((t): TableColumn[] => ([
  { field: 'name', label: t('Command'), kind: 'code', width: '40%' },
  { field: 'description', label: t('Description'), wrap: true },
]))

const COMMANDS = perLocale(t => ([
  { id: 'catalog', name: 'lumi-check catalog', description: t('Read the application Catalog, filtered to components or actions or one name') },
  { id: 'describe', name: 'lumi-check describe', description: t('Read the props schema, slots and events of one component') },
  { id: 'check', name: 'lumi-check <file>', description: t('Validate a Spec, manifest or theme. Never calls your backend or renders UI') },
]))

const CATALOG_FLAG = '--catalog ./lumi.catalog.mjs'

function command(args: string): string {
  return `npx lumi-check ${args} ${CATALOG_FLAG}`
}

const CONNECT_FILES: readonly CodeFile[] = [
  {
    name: 'terminal',
    language: 'bash',
    code: `# Every component and action, with a one-line description
${command('catalog')}
# One component: props as JSON Schema, slots and events
${command('describe Table')}
# Validate a page; exit code 0 valid, 1 invalid, 2 file or catalog problem
${command('page.json --json')}`,
  },
  {
    name: 'lumi.catalog.mjs',
    language: 'ts',
    code: `// The application Catalog, custom components included. Without --catalog
// the commands use the Lumi Admin preset.
import { adminCatalogDefinitions } from '@duxweb/lumi-admin/catalog'
import { translateDirective } from '@duxweb/lumi/catalog'
import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'

export const catalog = defineCatalog(schema, adminCatalogDefinitions)
export const directives = [translateDirective]`,
  },
]

const definitions = showcaseCatalog.data as CatalogDefinitions
const componentOptions = Object.keys(definitions.components).sort().map(name => ({ value: name, label: name }))
const actionOptions = Object.keys(definitions.actions ?? {}).sort().map(name => ({ value: name, label: name }))

function GetCatalogExample(): ReactElement {
  const t = useTranslate()
  const [name, setName] = useState('submitForm')
  const args = useMemo(() => ({ kind: 'actions' as const, name }), [name])
  const output = useMemo(() => getCatalog(showcaseCatalog, args), [args])
  return (
    <LumiCodeExample
      title="lumi-check catalog"
      code={<Code files={[{ name: 'terminal', language: 'bash', code: command(`catalog --kind actions --name ${name}`) }]} />}
      previewLabel={t('Command output')}
      previewActions={<Select ariaLabel={t('Action')} size="sm" filterable options={actionOptions} value={name} onChange={value => setName(String(value ?? 'submitForm'))} />}
      preview={<CodeBlock title="stdout" language="json" code={json(output)} data-testid="command-output" />}
    />
  )
}

function DescribeExample(): ReactElement {
  const t = useTranslate()
  const [type, setType] = useState('Table')
  const [output, setOutput] = useState<unknown>()
  return (
    <LumiCodeExample
      title="lumi-check describe"
      code={<Code files={[{ name: 'terminal', language: 'bash', code: command(`describe ${type}`) }]} />}
      previewLabel={t('Command output')}
      previewActions={(
        <>
          <Select ariaLabel={t('Component')} size="sm" filterable options={componentOptions} value={type} onChange={value => setType(String(value ?? 'Table'))} />
          <Button label={t('Run {command}', { command: 'lumi-check describe' })} appearance="ghost" size="sm" onClick={() => setOutput(describeComponent(type, showcaseCatalog))} />
        </>
      )}
      preview={output === undefined ? <Alert tone="neutral" title={t('Run the command to see its output')} /> : <CodeBlock title="stdout" language="json" code={json(output)} data-testid="command-output" />}
    />
  )
}

function ValidateExample(): ReactElement {
  const t = useTranslate()
  const [document, setDocument] = useState(() => json(brokenSpec))
  const [output, setOutput] = useState<unknown>()
  const run = (): void => {
    try {
      setOutput(validateDocument(JSON.parse(document), showcaseCatalog))
    }
    catch (error) {
      setOutput({ valid: false, issues: [{ severity: 'error', path: '', code: 'invalid_json', message: error instanceof Error ? error.message : String(error) }] })
    }
  }
  return (
    <LumiCodeExample
      title="lumi-check page.json --json"
      codeLabel="page.json"
      code={<Editor label={t('Document')} value={document} onChange={setDocument} />}
      previewLabel={t('Command output')}
      previewActions={<Button label={t('Run {command}', { command: 'lumi-check' })} appearance="ghost" size="sm" onClick={run} />}
      preview={output === undefined ? <Alert tone="neutral" title={t('Run the command to see its output')} /> : <CodeBlock title="stdout" language="json" code={json(output)} data-testid="command-output" />}
    />
  )
}

export function AdminAuthorCommandsRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Author commands')} description={t('lumi-check commands, answered from this app\'s Catalog')}>
      <LumiCodeExample
        title={t('Give a coding agent the commands')}
        code={<Code files={CONNECT_FILES} />}
        previewLabel={t('Commands')}
        preview={<Table rowKey="id" columns={commandColumns(t)} rows={COMMANDS(t)} />}
      />
      <GetCatalogExample />
      <DescribeExample />
      <ValidateExample />
    </DeveloperPage>
  )
}
