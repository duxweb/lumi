import type { Spec } from '@json-render/core'
import { agentCommandSchema, agentSuggestionSchema, uiComponentDefinitions } from '@duxweb/lumi-ui/catalog'
import { optionsSourceSchema } from '@duxweb/lumi/catalog'
import { z } from 'zod'

/** The composer's @ references; `sources` searches one DataProvider resource per tab, keyed by its `value`. */
export const promptMentionsSchema = uiComponentDefinitions.PromptInput.props.shape.mentions.unwrap().extend({
  sources: z.record(z.string(), optionsSourceSchema).optional(),
})

/**
 * The Shell's assistant as the manifest describes it, so a backend can turn
 * it on and register its @ references and / commands. Labels are message
 * keys or plain text. A command with a `prompt` fills the composer; one
 * without it is sent to the `onEvent` listeners as `assistant.command`.
 */
export const adminAssistantSchema = z.strictObject({
  /** The agent's chat endpoint, relative to the API root. */
  endpoint: z.string().min(1),
  title: z.string().optional(),
  placeholder: z.string().optional(),
  /** Where conversations are kept; `agent-sessions` by default. */
  resource: z.string().min(1).optional(),
  suggestions: z.array(agentSuggestionSchema).optional(),
  mentions: promptMentionsSchema.optional(),
  commands: z.array(agentCommandSchema).optional(),
  /** Whether the panel starts open for a reader who has not toggled it yet. */
  defaultOpen: z.boolean().optional(),
  /** Whether the page being viewed goes with each message; true by default. */
  shareContext: z.boolean().optional(),
})

const label = z.string()
const group = z.strictObject({ name: z.string(), label, labelKey: z.string().optional(), icon: z.string().optional() })
export const adminAppSchema = z.strictObject({
  id: z.string().min(1),
  title: label.optional(),
  titleKey: z.string().optional(),
  subtitle: label.optional(),
  subtitleKey: z.string().optional(),
  /**
   * The browser tab's title, from `{page}` (the route's label) and `{app}`
   * (the title above); `"{page} · {app}"` by default, `false` leaves it alone.
   */
  documentTitle: z.union([z.string(), z.literal(false)]).optional(),
  logo: z.string().optional(),
  layout: z.enum(['single', 'dual']).optional(),
  tabs: z.boolean().optional(),
  /** Where the menu search sits: atop the sidebar (default), in the header, or nowhere. */
  search: z.enum(['sidebar', 'header', 'none']).optional(),
  /**
   * Workspaces (tenants, teams, stores) the user can switch between. With two
   * or more, the sidebar head becomes a switcher; `workspace` picks the one
   * shown first. Without them the head shows the app title and subtitle.
   */
  workspaces: z.array(z.strictObject({ value: z.string().min(1), label, description: z.string().optional(), logo: z.string().optional() })).optional(),
  workspace: z.string().optional(),
  /** Languages offered in the account menu; shown from two entries up. */
  locales: z.array(z.strictObject({ value: z.string().min(1), label: z.string().min(1) })).optional(),
  /** The assistant panel beside every page; see `adminAssistantSchema`. */
  assistant: adminAssistantSchema.optional(),
  header: z.strictObject({ actions: z.array(z.strictObject({ name: z.string(), label, labelKey: z.string().optional(), icon: z.string().optional(), drawer: z.string().optional(), href: z.string().optional(), event: z.string().optional() })).optional() }).optional(),
})
export const adminPageSchema = z.union([
  z.strictObject({ spec: z.custom<Spec>(value => Boolean(value && typeof value === 'object' && 'root' in value && 'elements' in value)) }),
  z.strictObject({ src: z.string().min(1) }),
  /** A page written in JavaScript: an ES module URL, relative to the manifest, loaded with `import()`. Never proxied. */
  z.strictObject({ module: z.string().min(1) }),
  /** Another site's page filling the page area, e.g. `https://report.example.com/sales`; relative to the manifest. */
  z.strictObject({ iframe: z.string().min(1) }),
])
export interface AdminRoute {
  name?: string
  path: string
  redirect?: string
  page?: { spec: Spec, src?: never, module?: never, iframe?: never } | { src: string, spec?: never, module?: never, iframe?: never } | { module: string, spec?: never, src?: never, iframe?: never } | { iframe: string, spec?: never, src?: never, module?: never }
  public?: boolean
  access?: { resource: string, action?: string }
  /** The data provider this route and the routes below it use unless a call names another. */
  dataProvider?: string
  menu?: { label: string, labelKey?: string, icon?: string, hidden?: boolean, order?: number, group?: z.infer<typeof group>, module?: z.infer<typeof group> }
  children?: AdminRoute[]
}
export const adminRouteSchema: z.ZodType<AdminRoute> = z.lazy(() => z.strictObject({
  name: z.string().optional(),
  path: z.string(),
  redirect: z.string().optional(),
  page: adminPageSchema.optional(),
  public: z.boolean().optional(),
  access: z.strictObject({ resource: z.string(), action: z.string().optional() }).optional(),
  dataProvider: z.string().min(1).optional(),
  menu: z.strictObject({ label, labelKey: z.string().optional(), icon: z.string().optional(), hidden: z.boolean().optional(), order: z.number().optional(), group: group.optional(), module: group.optional() }).optional(),
  children: z.array(adminRouteSchema).optional(),
}))
export const adminManifestSchema = z.strictObject({ app: adminAppSchema, routes: z.array(adminRouteSchema) })
export type AdminManifest = z.infer<typeof adminManifestSchema>
export type AdminApp = z.infer<typeof adminAppSchema>
export type AdminAssistant = z.infer<typeof adminAssistantSchema>
export type AdminPromptMentionsConfig = z.infer<typeof promptMentionsSchema>
export type AdminWorkspace = NonNullable<AdminApp['workspaces']>[number]
export type AdminLayout = NonNullable<AdminApp['layout']>
export type AdminPage = NonNullable<AdminRoute['page']>
export type AdminHeaderAction = NonNullable<NonNullable<AdminApp['header']>['actions']>[number]
export type TextValue = string

export type AdminEventHandler = (event: { name: string, payload: Record<string, unknown> }) => void | Promise<void>
