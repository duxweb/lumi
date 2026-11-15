import type {
  Catalog,
  DirectiveDefinition,
  Spec,
  UIElement,
} from '@json-render/core'
import { ActionBindingSchema, validateSpec } from '@json-render/core'
import { z } from 'zod'
import { translateDirective } from './core/translate-directive.js'

interface TranslationTable { [key: string]: string | TranslationTable }
const translationTableSchema: z.ZodType<TranslationTable> = z.lazy(() => z.record(z.string(), z.union([z.string(), translationTableSchema])))
/**
 * A page's own `translations`: per locale (`zh-CN`), keys to text, flat or
 * nested. `$t` reads them before the app's shared translations.
 */
export const pageTranslationsSchema = z.record(z.string().min(1), translationTableSchema)

export interface DocumentIssue {
  code: string
  path: string
  message: string
  hint: string
  severity: 'error' | 'warning'
}

export interface DocumentValidation {
  valid: boolean
  issues: DocumentIssue[]
}

export interface ComponentDefinition {
  props: z.ZodType
  description?: string
  slots?: readonly string[]
  events?: readonly string[]
}

export interface ActionDefinition {
  params: z.ZodType
  description?: string
}

export interface CatalogDefinitions {
  components: Record<string, ComponentDefinition>
  actions?: Record<string, ActionDefinition>
}

// Upstream exposes names and descriptions for these React actions, but no
// parameter schemas. This single supplement serves validation and CLI lookup;
// execution stays in the native ActionProvider.
const statePath = z.string().min(1)
const nativeActionParams: Record<string, z.ZodType> = {
  setState: z.strictObject({ statePath, value: z.unknown() }),
  pushState: z.strictObject({ statePath, value: z.unknown(), clearStatePath: statePath.optional() }),
  removeState: z.strictObject({ statePath, index: z.number().int().nonnegative() }),
  validateForm: z.strictObject({ statePath: statePath.optional() }),
}

/** The same action parameters for document validation and author tooling. */
export function getActionParams(catalog: Catalog, name: string): z.ZodType | undefined {
  if (catalog.schema.builtInActions?.some(action => action.name === name) && Object.hasOwn(nativeActionParams, name))
    return nativeActionParams[name]
  const definitions = catalog.data as CatalogDefinitions
  return definitions.actions && Object.hasOwn(definitions.actions, name) ? definitions.actions[name]?.params : undefined
}

function pointer(path: readonly PropertyKey[]): string {
  return path
    .map(key => `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`)
    .join('')
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Expressions are validated by the upstream renderer, not evaluated by author tools.
// The renderer resolves props and action params key by key, so an expression
// can stand for a value inside them but never for the whole object: `root`
// is that object, where `$state` and the like are ordinary (unknown) keys.
function dynamicAt(
  value: unknown,
  path: readonly PropertyKey[],
  directives: readonly DirectiveDefinition[],
  root = true,
): boolean {
  if (
    !root
    && object(value)
    && directives.some(
      directive =>
        Object.hasOwn(value, directive.name)
        && directive.schema.safeParse(value).success,
    )
  ) {
    return true
  }
  if (
    !root
    && object(value)
    && ([
      '$state',
      '$bindState',
      '$bindItem',
      '$item',
      '$computed',
      '$template',
    ].some(key => typeof value[key] === 'string')
    || value.$index === true
    || ('$cond' in value && '$then' in value && '$else' in value))
  ) {
    return true
  }
  if (path.length === 0 || value === null || typeof value !== 'object')
    return false
  return dynamicAt(
    (value as Record<PropertyKey, unknown>)[path[0]!],
    path.slice(1),
    directives,
    false,
  )
}

/**
 * zod declares `sideEffects: false`, so bundlers drop the `config(en())` call
 * in its entry and every message collapses to "Invalid input". Install the
 * English messages on first use unless the application chose a locale.
 */
function ensureZodMessages(): void {
  if (!z.config().localeError)
    z.config(z.locales.en())
}

/** Checks a page Spec against a Catalog and answers `{ valid, issues }`, each issue at a JSON Pointer path. The runtime loader and `lumi-check` share it. */
export function validateDocument(
  document: unknown,
  catalog: Catalog,
  options: {
    maxElements?: number
    maxDepth?: number
    directives?: readonly DirectiveDefinition[]
  } = {},
): DocumentValidation {
  ensureZodMessages()
  // `$t` is always available: every Lumi provider resolves it.
  const directives = [translateDirective, ...(options.directives ?? [])]
  const issues: DocumentIssue[] = []
  const add = (
    code: string,
    path: string,
    message: string,
    hint = 'Check the application catalog and the reported value.',
    severity: DocumentIssue['severity'] = 'error',
  ): void => {
    issues.push({ code, path, message, hint, severity })
  }
  // A union reports one issue at its own path, so an expression nested in one
  // of its branches (`{ title: { "$t": … } }`) settles it when that branch
  // fails only where expressions stand.
  const settled = (issue: z.core.$ZodIssue, value: unknown, prefix: readonly PropertyKey[]): boolean => {
    const path = [...prefix, ...issue.path]
    if (dynamicAt(value, path, directives))
      return true
    return issue.code === 'invalid_union'
      && issue.errors.some(branch => branch.length > 0 && branch.every(nested => settled(nested, value, path)))
  }
  const check = (schema: z.ZodType, value: unknown, base: string): void => {
    const result = schema.safeParse(value)
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (!settled(issue, value, []))
          add(issue.code, `${base}${pointer(issue.path)}`, issue.message)
      }
    }
  }
  const seen = new Set<object>()
  let nodes = 0
  const inspect = (value: unknown, path: string, depth = 0): void => {
    if (++nodes > 100000) {
      if (nodes === 100001)
        add('document_size', path, 'Document exceeds the value limit.')
      return
    }
    if (depth > (options.maxDepth ?? 128)) {
      add('maximum_depth', path, 'Document nesting exceeds the limit.')
      return
    }
    if (
      typeof value === 'function'
      || typeof value === 'symbol'
      || typeof value === 'bigint'
      || (typeof value === 'number' && !Number.isFinite(value))
    ) {
      add('not_serializable', path, 'Expected serializable JSON data.')
      return
    }
    if (!value || typeof value !== 'object')
      return
    if (seen.has(value)) {
      add('cyclic_value', path, 'JSON values cannot contain cycles.')
      return
    }
    if (
      !Array.isArray(value)
      && Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null
    ) {
      add('not_serializable', path, 'Expected a plain JSON object.')
      return
    }
    seen.add(value)
    for (const [key, child] of Object.entries(value))
      inspect(child, `${path}${pointer([key])}`, depth + 1)
    seen.delete(value)
  }
  inspect(document, '')
  if (issues.length)
    return { valid: false, issues }
  if (
    !object(document)
    || typeof document.root !== 'string'
    || !object(document.elements)
  ) {
    add(
      'invalid_spec',
      '',
      'Expected a native Spec with root and elements.',
      'Supply an upstream json-render Spec.',
    )
    return { valid: false, issues }
  }
  const entries = Object.entries(document.elements)
  if (entries.length > (options.maxElements ?? 10000)) {
    add(
      'too_many_elements',
      '/elements',
      'The document exceeds the element limit.',
    )
    return { valid: false, issues }
  }
  const definitions = catalog.data as CatalogDefinitions
  const actions = new Set([
    ...catalog.actionNames,
    ...(catalog.schema.builtInActions ?? []).map(action => action.name),
  ])
  const edges = new Map<string, string[]>()
  for (const [key, element] of entries) {
    const base = `/elements${pointer([key])}`
    if (
      !object(element)
      || typeof element.type !== 'string'
      || !object(element.props)
      || (element.children !== undefined
        && (!Array.isArray(element.children)
          || element.children.some(child => typeof child !== 'string')))
    ) {
      add(
        'invalid_element',
        base,
        'Elements require type and props; children, when present, must be an array of element keys.',
      )
      continue
    }
    // An own entry only: `constructor` or `toString` is not a component.
    const definition = Object.hasOwn(definitions.components, element.type) ? definitions.components[element.type] : undefined
    if (!definition) {
      add(
        'unknown_component',
        `${base}/type`,
        `Unknown component: ${element.type}`,
      )
    }
    else {
      check(definition.props, element.props, `${base}/props`)
    }
    const children = [...((element.children as string[] | undefined) ?? [])]
    if (
      children.length
      && definition?.slots
      && !definition.slots.includes('default')
    ) {
      add(
        'unknown_slot',
        `${base}/children`,
        'This component does not accept default children.',
      )
    }
    if (element.slots !== undefined) {
      if (!object(element.slots)) {
        add(
          'invalid_slots',
          `${base}/slots`,
          'Slots must map names to element key arrays.',
        )
      }
      else {
        for (const [name, refs] of Object.entries(element.slots)) {
          if (name === 'default' || !definition?.slots?.includes(name)) {
            add(
              'unknown_slot',
              `${base}/slots${pointer([name])}`,
              `Unknown named slot: ${name}`,
            )
          }
          if (
            !Array.isArray(refs)
            || refs.some(ref => typeof ref !== 'string')
          ) {
            add(
              'invalid_slot',
              `${base}/slots${pointer([name])}`,
              'Expected an array of element keys.',
            )
          }
          else {
            children.push(...refs)
          }
        }
      }
    }
    edges.set(key, children)
    const checkAction = (value: unknown, path: string, depth = 0): void => {
      if (depth > 32) {
        add('action_depth', path, 'Action nesting exceeds the limit.')
        return
      }
      if (!object(value)) {
        add('invalid_action', path, 'Expected a native action binding object.')
        return
      }
      if (value.params !== undefined && !object(value.params)) {
        add(
          'invalid_params',
          `${path}/params`,
          'Action params must be an object.',
        )
      }
      // The upstream envelope schema uses a narrower DynamicValue for params
      // than its renderer accepts. Validate native envelopes separately from
      // Catalog-owned nested parameters, without changing execution semantics.
      const envelope = { ...value, params: undefined }
      for (const branch of ['onSuccess', 'onError'] as const) {
        const next = value[branch]
        if (object(next))
          Object.assign(envelope, { [branch]: { ...next, params: undefined } })
      }
      const parsed = ActionBindingSchema.strict().safeParse(envelope)
      if (!parsed.success) {
        for (const issue of parsed.error.issues)
          add(issue.code, `${path}${pointer(issue.path)}`, issue.message)
        return
      }
      const binding = { ...parsed.data, params: value.params }
      if (!actions.has(binding.action)) {
        add(
          'unknown_action',
          `${path}/action`,
          `Unknown action: ${binding.action}`,
        )
      }
      const params = getActionParams(catalog, binding.action)
      if (params)
        check(params, binding.params ?? {}, `${path}/params`)
      if (binding.action === 'notify' && object(binding.params) && Array.isArray(binding.params.actions)) {
        for (const [index, item] of binding.params.actions.entries()) {
          if (!object(item))
            continue
          const { label: _label, ...nested } = item
          checkAction(nested, `${path}/params/actions/${index}`, depth + 1)
        }
      }
      for (const branch of ['onSuccess', 'onError'] as const) {
        const next = binding[branch]
        if (next && 'action' in next)
          checkAction(value[branch], `${path}/${branch}`, depth + 1)
      }
    }
    for (const kind of ['on', 'watch'] as const) {
      const bindings = element[kind]
      if (bindings === undefined)
        continue
      if (!object(bindings)) {
        add(
          'invalid_bindings',
          `${base}/${kind}`,
          'Expected an event or state-path map.',
        )
        continue
      }
      for (const [event, value] of Object.entries(bindings)) {
        const path = `${base}/${kind}${pointer([event])}`
        if (
          kind === 'on'
          && definition?.events
          && !definition.events.includes(event)
        ) {
          add('unknown_event', path, `Unknown event: ${event}`)
        }
        if (kind === 'watch' && !event.startsWith('/')) {
          add(
            'invalid_pointer',
            path,
            'Watch keys must be JSON Pointer paths.',
          )
        }
        if (Array.isArray(value)) {
          value.forEach((binding, index) =>
            checkAction(binding, `${path}/${index}`),
          )
        }
        else {
          checkAction(value, path)
        }
      }
    }
  }
  // Check cycles before upstream traversal so malformed documents cannot recurse forever.
  const visited = new Set<string>()
  const active = new Set<string>()
  const visit = (key: string, depth: number): void => {
    if (active.has(key)) {
      add(
        'cyclic_reference',
        `/elements${pointer([key])}`,
        'Cyclic element reference.',
      )
      return
    }
    if (depth > (options.maxDepth ?? 128)) {
      add(
        'maximum_depth',
        `/elements${pointer([key])}`,
        'Element nesting exceeds the limit.',
      )
      return
    }
    if (visited.has(key))
      return
    visited.add(key)
    active.add(key)
    for (const child of edges.get(key) ?? []) {
      if (!edges.has(child)) {
        add(
          'missing_child',
          `/elements${pointer([key])}`,
          `Missing child: ${child}`,
        )
      }
      else {
        visit(child, depth + 1)
      }
    }
    active.delete(key)
  }
  visit(document.root, 0)
  for (const key of edges.keys()) visit(key, 0)
  if (!issues.some(issue => issue.severity === 'error')) {
    const nativeSchema = catalog.zodSchema()
    // Extend the platform's own schema with the native state/event fields it
    // omits from generation. Component schemas and built-ins remain upstream.
    if (
      nativeSchema instanceof z.ZodObject
      && nativeSchema.shape.elements instanceof z.ZodRecord
      && nativeSchema.shape.elements.valueType instanceof z.ZodObject
    ) {
      const element = nativeSchema.shape.elements.valueType
        .extend({
          children: z.array(z.string()).optional(),
          on: z.record(z.string(), z.unknown()).optional(),
          watch: z.record(z.string(), z.unknown()).optional(),
        })
        .strict()
      check(
        nativeSchema
          .extend({
            state: z.record(z.string(), z.unknown()).optional(),
            elements: z.record(z.string(), element),
            // Lumi's addition: the page's own text per locale, read by `$t`.
            translations: pageTranslationsSchema.optional(),
          })
          .strict(),
        document,
        '',
      )
    }
    else {
      check(nativeSchema, document, '')
    }
    const native = validateSpec(document as unknown as Spec)
    for (const issue of native.issues) {
      add(
        issue.code,
        issue.elementKey ? `/elements${pointer([issue.elementKey])}` : '',
        issue.message,
        'Correct the native Spec structure.',
        issue.severity,
      )
    }
  }
  return { valid: !issues.some(issue => issue.severity === 'error'), issues }
}

/** Throws, naming every issue, when a document is not a valid Spec for the Catalog. */
export function assertDocument(
  document: unknown,
  catalog: Catalog,
): asserts document is Spec {
  const result = validateDocument(document, catalog)
  if (!result.valid) {
    throw new Error(
      result.issues
        .map(issue => `${issue.path}: ${issue.message}`)
        .join('\n'),
    )
  }
}

export type { Spec, UIElement }

export type DocumentValidationOptions = NonNullable<Parameters<typeof validateDocument>[2]>
