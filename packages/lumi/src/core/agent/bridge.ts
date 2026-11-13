/**
 * The agent bridge: what the agent sees of the running front end and the
 * client tools it acts through. Nothing is declared per component. A Spec
 * page registers itself, and the bridge reads its elements, their
 * `$bindState` paths and `on` events, and the page state; the Shell
 * registers its routes and how to navigate. The agent then has three verbs:
 * navigate, set a bound value, and fire an element's event, the last asking
 * the reader first in `ask` mode when the event changes data.
 */

/** `ask` waits for the reader before anything that changes data; `auto` acts at once. */
import type { AgentChatContextItem } from './merge.js'

export type AgentApprovalMode = 'ask' | 'auto'

export const AGENT_APPROVAL_MODES: readonly AgentApprovalMode[] = ['ask', 'auto']

/** An element the agent can read or act on: one with bound state or events. */
export interface AgentUiElement {
  id: string
  type: string
  label?: string
  /** Prop name to the state path it is bound to; `statePath` covers a whole region. */
  bind?: Record<string, string>
  /** Light events the agent may fire with `ui_trigger`. */
  events?: string[]
  /** Events that change data: the reader presses these, or a backend tool does the work. */
  writes?: string[]
  /** What the element works on, such as its resource or column fields. */
  info?: Record<string, unknown>
}

export interface AgentUiPage {
  id: string
  title?: string
  elements: AgentUiElement[]
  /** The page state, shortened: long lists keep their first items and a count. */
  state: unknown
}

export interface AgentUiRoute {
  path: string
  title?: string
  group?: string
}

/** The workspace (tenant, team, store) the reader works in; the agent stays inside it. */
export interface AgentUiWorkspace {
  value: string
  label?: string
}

/** What goes with every request: where the reader is and what the page holds. */
export interface AgentUiSnapshot {
  route?: AgentUiRoute
  routes?: AgentUiRoute[]
  workspace?: AgentUiWorkspace
  page?: AgentUiPage
  approvalMode: AgentApprovalMode
}

/** A Spec-like document: only what the bridge reads. */
export interface AgentPageSpec {
  root: string
  elements: Record<string, { type: string, props?: Record<string, unknown>, on?: Record<string, unknown>, children?: string[] }>
}

/** A mounted page, as the renderer registers it. */
export interface AgentPageHandle {
  id: string
  title?: string
  spec: AgentPageSpec
  getState: () => Record<string, unknown>
  setState: (path: string, value: unknown) => void
  /** Runs the element's `on[event]` actions as the element itself would. */
  trigger: (element: string, event: string) => Promise<void>
  /** Flags rows with these keys for a moment and scrolls to the first. */
  highlight?: (keys: Array<string | number>) => void
  /** Flashes the control on screen with this label and scrolls to it; false when none shows. */
  flash?: (label: string) => boolean
  /** The `name` of the form field the reader is typing in, if any; the agent leaves it alone. */
  focused?: () => string | undefined
  /** The page's own translator, for `{ $t }` labels and approval copy. */
  translate?: AgentBridgeOptions['translate']
}

/** How the host moves between pages; Admin registers its Shell. */
export interface AgentNavigation {
  current: () => AgentUiRoute | undefined
  routes: () => AgentUiRoute[]
  navigate: (path: string) => void
  /** The current workspace; read only, as switching it is the reader's call. */
  workspace?: () => AgentUiWorkspace | undefined
}

/** What the reader is asked before a client tool runs. */
export interface AgentToolApproval {
  title: string
  description?: string
  tone?: 'neutral' | 'warning' | 'danger'
}

export interface AgentClientTool {
  description: string
  /** JSON Schema of the input, sent to the server with the tool. */
  inputSchema: Record<string, unknown>
  /** Throws to report a failure back to the model. */
  execute: (input: unknown) => unknown | Promise<unknown>
  /** The card shown first in `ask` mode, or undefined when the call is harmless. */
  approval?: (input: unknown) => AgentToolApproval | undefined
}

export interface AgentToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface AgentBridgeOptions {
  /** Navigation used until a host registers its own, e.g. the Lumi router provider. */
  navigation?: () => AgentNavigation | undefined
  /** Resolves `{ $t }` labels and the approval copy. */
  translate?: (key: string, fallback: string, params?: Record<string, unknown>) => string
  /** Actions an event may run without asking; others change data and ask in `ask` mode. */
  safeActions?: readonly string[]
  /** Where the approval mode is kept between visits; leave out to keep it in memory. */
  storageKey?: string
  approvalMode?: AgentApprovalMode
}

export interface AgentBridge {
  getApprovalMode: () => AgentApprovalMode
  setApprovalMode: (mode: AgentApprovalMode) => void
  /** Called when the approval mode or the registered pages change. */
  subscribe: (listener: () => void) => () => void
  registerPage: (page: AgentPageHandle) => () => void
  registerNavigation: (navigation: AgentNavigation) => () => void
  /**
   * Puts records into the conversation, e.g. selected table rows: the open
   * conversation adds them to the next message's context. Kept until one listens.
   */
  reference: (items: AgentChatContextItem[]) => void
  onReference: (listener: (items: AgentChatContextItem[]) => void) => () => void
  snapshot: () => AgentUiSnapshot
  tools: () => Record<string, AgentClientTool>
  toolDefinitions: () => AgentToolDefinition[]
}

/** Actions that only move the view or local page state. */
export const AGENT_SAFE_ACTIONS: readonly string[] = [
  'setState',
  'pushState',
  'removeState',
  'validateForm',
  'navigate',
  'openDrawer',
  'closeDrawer',
  'invalidate',
  'toast',
  'notify',
  'closeNotice',
]

const LABEL_PROPS = ['title', 'label', 'ariaLabel', 'placeholder', 'name']
const ESCAPED_SLASH_RE = /~1/g
const ESCAPED_TILDE_RE = /~0/g
const TILDE_RE = /~/g
const SLASH_RE = /\//g
const PATH_TAIL_RE = /[?#]/
const NAVIGATE_WAIT = 1500
const NAVIGATE_STEP = 50
const NAVIGATE_SETTLE = 500
const MAX_ITEMS = 10
const MAX_TEXT = 300
const MAX_DEPTH = 6

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function storage(): { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void } | undefined {
  try {
    return (globalThis as { localStorage?: { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void } }).localStorage
  }
  catch {
    return undefined
  }
}

/** The page state, short enough to send with every message. */
export function compactAgentState(value: unknown, depth = 0): unknown {
  if (typeof value === 'string')
    return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value
  if (typeof value !== 'object' || value === null)
    return value
  if (depth >= MAX_DEPTH)
    return Array.isArray(value) ? `[${value.length} items]` : '{…}'
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map(item => compactAgentState(item, depth + 1))
    return value.length > MAX_ITEMS ? [...items, `…${value.length - MAX_ITEMS} more`] : items
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, compactAgentState(entry, depth + 1)]))
}

function sameValue(left: unknown, right: unknown): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right)
}

function escapeSegment(key: string): string {
  return key.replace(TILDE_RE, '~0').replace(SLASH_RE, '~1')
}

/**
 * What the agent's write becomes once the reader's own edits are kept:
 * `base` is the value the agent saw, `current` the value now. A value the
 * reader changed since, or a field they are typing in, stays as it is and is
 * listed in `kept`; objects merge key by key so the rest still lands.
 */
function mergeAgentWrite(base: unknown, current: unknown, next: unknown, path: string, guarded: readonly string[], kept: string[]): unknown {
  const changed = !sameValue(base, current)
  const now = record(current)
  const wanted = record(next)
  if (now && wanted && (changed || guarded.some(entry => entry.startsWith(`${path}/`)))) {
    const merged: Record<string, unknown> = { ...now }
    for (const [key, value] of Object.entries(wanted))
      merged[key] = mergeAgentWrite(record(base)?.[key], now[key], value, `${path}/${escapeSegment(key)}`, guarded, kept)
    return merged
  }
  if ((changed || guarded.includes(path)) && !sameValue(current, next)) {
    kept.push(path)
    return current
  }
  return next
}

/** `state` with `value` at `path`, copying only the containers on the way. */
function writePath(state: unknown, path: string, value: unknown): unknown {
  const [head, ...rest] = path.split('/').slice(1)
  if (head === undefined)
    return value
  const key = head.replace(ESCAPED_SLASH_RE, '/').replace(ESCAPED_TILDE_RE, '~')
  const inner = rest.length ? `/${rest.join('/')}` : ''
  if (Array.isArray(state)) {
    const copy = state.slice()
    copy[Number(key)] = writePath(state[Number(key)], inner, value)
    return copy
  }
  const base = record(state) ?? {}
  return { ...base, [key]: writePath(base[key], inner, value) }
}

function readPath(state: unknown, path: string): unknown {
  let current: unknown = state
  for (const segment of path.split('/').slice(1)) {
    const key = segment.replace(ESCAPED_SLASH_RE, '/').replace(ESCAPED_TILDE_RE, '~')
    if (Array.isArray(current))
      current = current[Number(key)]
    else current = record(current)?.[key]
    if (current === undefined)
      return undefined
  }
  return current
}

/**
 * The elements of a Spec the agent can use: those bound to state or with
 * events, named by their key, labelled from their title or label.
 */
export function describeAgentElements(spec: AgentPageSpec, translate?: AgentBridgeOptions['translate'], safeActions: readonly string[] = AGENT_SAFE_ACTIONS): AgentUiElement[] {
  const text = (value: unknown): string | undefined => {
    if (typeof value === 'string')
      return value
    const key = record(value)?.$t
    return typeof key === 'string' ? (translate ? translate(key, key) : key) : undefined
  }
  const elements: AgentUiElement[] = []
  for (const [id, element] of Object.entries(spec.elements)) {
    const props = element.props ?? {}
    const bind: Record<string, string> = {}
    for (const [name, value] of Object.entries(props)) {
      const path = record(value)?.$bindState
      if (typeof path === 'string')
        bind[name] = path
    }
    if (typeof props.statePath === 'string' && props.statePath.startsWith('/'))
      bind.statePath = props.statePath
    const all = Object.keys(element.on ?? {})
    const light = (event: string): boolean => {
      const actions = eventActions(spec, id, event)
      return Boolean(actions && !actions.confirm && actions.names.every(name => safeActions.includes(name)))
    }
    const events = all.filter(light)
    const writes = all.filter(event => !light(event))
    const href = typeof props.href === 'string' ? props.href : undefined
    if (!Object.keys(bind).length && !all.length && !href)
      continue
    const label = LABEL_PROPS.map(name => text(props[name])).find(Boolean)
    const info: Record<string, unknown> = {}
    if (href)
      info.href = href
    if (typeof props.resource === 'string')
      info.resource = props.resource
    if (Array.isArray(props.columns)) {
      info.columns = props.columns.flatMap((column) => {
        const entry = record(column)
        const field = entry?.field ?? entry?.key
        return typeof field === 'string' ? [{ field, label: text(entry?.label ?? entry?.title) }] : []
      })
    }
    const fields = record(props.schema)?.fields
    if (Array.isArray(fields)) {
      info.fields = fields.flatMap((field) => {
        const entry = record(field)
        return typeof entry?.field === 'string' ? [{ field: entry.field, label: text(entry.label), widget: entry.widget }] : []
      })
    }
    elements.push({
      id,
      type: element.type,
      ...(label ? { label } : {}),
      ...(Object.keys(bind).length ? { bind } : {}),
      ...(events.length ? { events } : {}),
      ...(writes.length ? { writes } : {}),
      ...(Object.keys(info).length ? { info } : {}),
    })
  }
  return elements
}

/** The actions an element's event runs, by name. */
function eventActions(spec: AgentPageSpec, element: string, event: string): { names: string[], confirm: boolean } | undefined {
  const binding = spec.elements[element]?.on?.[event]
  if (!binding)
    return undefined
  const list = Array.isArray(binding) ? binding : [binding]
  return {
    names: list.map(entry => String(record(entry)?.action ?? '')),
    confirm: list.some(entry => record(entry)?.confirm !== undefined),
  }
}

/** The bridge between pages and the agent: pages register what they show, and it answers the UI snapshot and the client tools the agent acts through. */
export function createAgentBridge(options: AgentBridgeOptions = {}): AgentBridge {
  const listeners = new Set<() => void>()
  const pages: AgentPageHandle[] = []
  const referenceListeners = new Set<(items: AgentChatContextItem[]) => void>()
  let pendingReferences: AgentChatContextItem[] = []
  const navigations: AgentNavigation[] = []
  const safe = new Set(options.safeActions ?? AGENT_SAFE_ACTIONS)
  const translator = (): AgentBridgeOptions['translate'] => pages.at(-1)?.translate ?? options.translate
  // Read on first use: storage may be blocked, and nothing needs the mode until a reply or the switch does.
  let mode: AgentApprovalMode | undefined
  const currentMode = (): AgentApprovalMode => {
    if (mode)
      return mode
    let stored: string | null | undefined
    try {
      stored = options.storageKey ? storage()?.getItem(options.storageKey) : null
    }
    catch {}
    mode = stored === 'auto' || stored === 'ask' ? stored : options.approvalMode ?? 'ask'
    return mode
  }

  const notify = (): void => {
    for (const listener of listeners)
      listener()
  }
  // The page mounted last is the one in front: Admin swaps one route page for the next.
  const page = (): AgentPageHandle | undefined => pages.at(-1)
  const navigation = (): AgentNavigation | undefined => navigations.at(-1) ?? options.navigation?.()

  const requirePage = (): AgentPageHandle => {
    const current = page()
    if (!current)
      throw new Error('No page is open that the agent can act on.')
    return current
  }
  // The page and state the last request showed the agent: tool calls answer
  // that snapshot, so they must not land on another page or undo what the
  // reader changed while the agent was thinking.
  let seen: { page?: AgentPageHandle, state?: unknown } = {}
  const requireSeenPage = (): AgentPageHandle => {
    const current = requirePage()
    if (seen.page && seen.page !== current)
      throw new Error('The reader is on another page than the one in your UI snapshot. Read the new snapshot before acting.')
    return current
  }
  /** The state paths of the field the reader is typing in, as forms and bound fields name it. */
  const editingPaths = (current: AgentPageHandle): string[] => {
    const name = current.focused?.()
    if (!name)
      return []
    return describeAgentElements(current.spec).flatMap(element => Object.entries(element.bind ?? {}).flatMap(([prop, bound]) =>
      prop === 'statePath' ? [`${bound}/${escapeSegment(name)}`] : bound.endsWith(`/${escapeSegment(name)}`) ? [bound] : []))
  }
  const isLight = (actions: { names: string[], confirm: boolean }): boolean => !actions.confirm && actions.names.every(name => safe.has(name))
  const writable = (current: AgentPageHandle, path: string): boolean =>
    describeAgentElements(current.spec).some(element => Object.values(element.bind ?? {}).some(bound => path === bound || path.startsWith(`${bound}/`)))

  const tools: Record<string, AgentClientTool> = {
    ui_navigate: {
      description: 'Open a page of the app by its path, one of `routes` in the UI snapshot.',
      inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'The path, e.g. /orders' } }, required: ['path'], additionalProperties: false },
      async execute(input) {
        const path = String(record(input)?.path ?? '')
        const nav = navigation()
        if (!path.startsWith('/') || !nav)
          throw new Error(`Cannot open ${path || 'that page'}.`)
        const before = page()
        const from = nav.current()?.path
        nav.navigate(path)
        // The reply goes on with the next snapshot, so wait until the route is
        // the new one and its page has replaced the old (or a short timeout).
        // A route without a Spec page registers none, so once the route has
        // changed only a short while is given for a page to appear.
        const target = path.split(PATH_TAIL_RE)[0]
        let arrived: number | undefined
        for (let waited = 0; waited < NAVIGATE_WAIT; waited += NAVIGATE_STEP) {
          const fresh = page()
          if (fresh && fresh !== before)
            break
          if (arrived === undefined && navigation()?.current()?.path === target)
            arrived = waited
          if (arrived !== undefined && waited - arrived >= NAVIGATE_SETTLE)
            break
          await new Promise(resolve => setTimeout(resolve, NAVIGATE_STEP))
        }
        const opened = page()
        // Still where it was: the move was held, e.g. by an unsaved-changes prompt.
        if (opened === before && from !== target && navigation()?.current()?.path === from)
          throw new Error(`${path} did not open. The page may be asking the reader whether to leave unsaved changes; wait for them.`)
        return { opened: path, ...(opened && opened !== before && opened.title ? { title: opened.title } : {}) }
      },
    },
    ui_set_state: {
      description: 'Set a value the page binds, such as filters, a selection, form values or whether a dialog is open. `path` must be a `bind` path of an element in the UI snapshot, or below one; prefer the narrowest path, e.g. /draft/title rather than /draft. Form values are only filled in: the reader reviews and submits. Values the reader changed since the snapshot, and the field they are typing in, are kept and listed in `kept`.',
      inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'A JSON Pointer state path, e.g. /filters/q' }, value: { description: 'The new value' } }, required: ['path', 'value'], additionalProperties: false },
      execute(input) {
        const current = requireSeenPage()
        const path = String(record(input)?.path ?? '')
        if (!writable(current, path))
          throw new Error(`${path} is not bound by any element on this page.`)
        const now = readPath(current.getState(), path)
        const base = seen.page === current ? readPath(seen.state, path) : now
        const kept: string[] = []
        const value = mergeAgentWrite(base, now, record(input)?.value, path, editingPaths(current), kept)
        if (!sameValue(value, now))
          current.setState(path, value)
        // The agent's own write is part of what it knows now; only this path moves.
        if (seen.page === current)
          seen = { page: current, state: writePath(seen.state, path, readPath(current.getState(), path)) }
        return {
          set: path,
          value: readPath(current.getState(), path),
          ...(kept.length ? { kept, note: 'The reader changed or is editing these; their values were kept.' } : {}),
        }
      },
    },
    ui_highlight: {
      description: 'Point the reader at something on the page; it is marked for a few seconds and scrolled into view. Give `keys` to flag table rows by their keys (usually ids) from the page state, or `element` to flash a control of the UI snapshot, such as the button the reader should press next.',
      inputSchema: {
        type: 'object',
        properties: {
          keys: { type: 'array', items: { type: ['string', 'number'] }, minItems: 1, description: 'Row keys' },
          element: { type: 'string', description: 'An element id from the UI snapshot' },
        },
        additionalProperties: false,
      },
      execute(input) {
        const current = requireSeenPage()
        const element = record(input)?.element
        if (typeof element === 'string') {
          const label = describeAgentElements(current.spec, translator()).find(entry => entry.id === element)?.label
          if (!label || !current.flash?.(label))
            throw new Error(`${element} is not on screen to point at.`)
          return { highlighted: element }
        }
        const keys = record(input)?.keys
        if (!Array.isArray(keys) || !keys.length || !current.highlight)
          throw new Error('Nothing to highlight on this page.')
        const valid = keys.filter((key): key is string | number => typeof key === 'string' || typeof key === 'number')
        current.highlight(valid)
        return { highlighted: valid }
      },
    },
    ui_trigger: {
      description: 'Fire a light event of an element in the UI snapshot, one of its `events`, as if the reader pressed it: switching a tab, opening a drawer, refreshing a list. Events that change data are listed under `writes` and are refused here: do business writes with your backend tools, or leave the button to the reader.',
      inputSchema: { type: 'object', properties: { element: { type: 'string', description: 'The element id' }, event: { type: 'string', description: 'One of its `events`' } }, required: ['element', 'event'], additionalProperties: false },
      async execute(input) {
        const current = requireSeenPage()
        const element = String(record(input)?.element ?? '')
        const event = String(record(input)?.event ?? '')
        const actions = eventActions(current.spec, element, event)
        if (!actions)
          throw new Error(`${element} has no ${event} event on this page.`)
        if (!isLight(actions))
          throw new Error(`${event} on ${element} changes data. The front end only fills and points; use a backend tool, or ask the reader to press it.`)
        await current.trigger(element, event)
        return { fired: event, element }
      },
    },
  }

  return {
    getApprovalMode: currentMode,
    setApprovalMode(next) {
      if (next === currentMode())
        return
      mode = next
      if (options.storageKey) {
        try {
          storage()?.setItem(options.storageKey, next)
        }
        catch {}
      }
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    registerPage(handle) {
      pages.push(handle)
      notify()
      return () => {
        const index = pages.indexOf(handle)
        if (index !== -1)
          pages.splice(index, 1)
        notify()
      }
    },
    reference(items) {
      if (!items.length)
        return
      if (!referenceListeners.size) {
        pendingReferences = [...pendingReferences, ...items]
        return
      }
      for (const listener of referenceListeners)
        listener(items)
    },
    onReference(listener) {
      referenceListeners.add(listener)
      if (pendingReferences.length) {
        const items = pendingReferences
        pendingReferences = []
        listener(items)
      }
      return () => referenceListeners.delete(listener)
    },
    registerNavigation(handle) {
      navigations.push(handle)
      return () => {
        const index = navigations.indexOf(handle)
        if (index !== -1)
          navigations.splice(index, 1)
      }
    },
    snapshot() {
      const nav = navigation()
      const current = page()
      seen = { page: current, state: current?.getState() }
      const route = nav?.current()
      const routes = nav?.routes()
      const workspace = nav?.workspace?.()
      return {
        ...(route ? { route } : {}),
        ...(routes?.length ? { routes } : {}),
        ...(workspace ? { workspace } : {}),
        ...(current
          ? {
              page: {
                id: current.id,
                ...(current.title ? { title: current.title } : {}),
                elements: describeAgentElements(current.spec, translator(), [...safe]),
                state: compactAgentState(current.getState()),
              },
            }
          : {}),
        approvalMode: currentMode(),
      }
    },
    tools: () => tools,
    toolDefinitions: () => Object.entries(tools).map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.inputSchema })),
  }
}
