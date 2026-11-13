import { themeConfigSchema } from '@duxweb/lumi-ui/catalog'
import { z } from 'zod'
import { adminManifestSchema } from './config.js'

/**
 * Everything the prebuilt Admin base needs to boot, as plain JSON. A backend
 * serves the base script once and describes each deployment with this object:
 * inline on the page (`window.LumiAdminConfig`), in a `<script type="application/json">`
 * block, or at a URL. Menus, pages, theme and messages may each be inline or a
 * URL the base fetches; nothing here is executable.
 */

/** A message table, or a URL that answers one. */
const messageSource = z.union([z.string().min(1), z.record(z.string(), z.string())])

/**
 * The sign-in page. Every string is looked up in the app's messages first
 * (the string itself is the key), so a JSON deployment can translate its own
 * copy; anything left out falls back to Lumi's translated defaults.
 */
export const adminLoginConfigSchema = z.strictObject({
  /** Product name beside the mark; defaults to the manifest's app title. */
  title: z.string().optional(),
  /** Line under the "Welcome back" heading. */
  subtitle: z.string().optional(),
  /** A short label above the headline, such as the product line. */
  badge: z.string().optional(),
  /** The headline beside the form, on every account page. */
  heroTitle: z.string().optional(),
  /** A phrase of the headline drawn in the brand colour. */
  heroHighlight: z.string().optional(),
  heroDescription: z.string().optional(),
  /** Points listed under the headline, each an icon, a title and a line; `[]` shows none. */
  features: z.array(z.strictObject({
    /** A Shell icon name (`shield`, `layout-dashboard`…) or any HugeIcons free icon. */
    icon: z.string().optional(),
    title: z.string(),
    /** One line under the title. */
    description: z.string().optional(),
  })).optional(),
  /** Where a reader who cannot get in finds help, at the top right. */
  help: z.strictObject({ label: z.string().optional(), linkLabel: z.string(), href: z.string() }).optional(),
  /** `false` hides "Create an account" even when the auth provider can register. */
  register: z.literal(false).optional(),
  /** The note under the form when there is no sign-up, e.g. that an administrator assigns accounts. */
  assignedNote: z.string().optional(),
  /** A demo deployment's account, offered in a hint that fills the form. Leave it out in production. */
  demo: z.strictObject({ username: z.string(), password: z.string() }).optional(),
  /**
   * `false` hides "Forgot password?"; `href` opens that page. Otherwise an auth
   * provider with `forgotPassword` opens the built-in reset page, and one
   * without shows `message` (or a default asking for the administrator) as a toast.
   */
  forgotPassword: z.union([z.literal(false), z.strictObject({ href: z.string().optional(), message: z.string().optional() })]).optional(),
  /** Offer "Remember me" (default true); the choice reaches the auth provider's `login` as `remember`. */
  remember: z.boolean().optional(),
  /** Links under the card, such as help, privacy or terms. */
  links: z.array(z.strictObject({ label: z.string(), href: z.string() })).optional(),
  /** Foot of the brand panel; defaults to `© <year> <title>`. */
  copyright: z.string().optional(),
})

export type AdminLoginConfig = z.infer<typeof adminLoginConfigSchema>

const name = z.string().min(1)
/** A route path inside the site: `/`, `/admin`, `/merchant/console`. */
const panelPath = z.string().regex(/^\/(?:[^/?#\s]+(?:\/[^/?#\s]+)*)?$/, 'a path such as /admin, without a trailing slash')

/**
 * One item, or several told apart by `name`. A single object is named
 * `default`; every item of a list names itself.
 */
// eslint-disable-next-line ts/explicit-function-return-type -- the schema type follows `shape`; spelling it out repeats zod's own.
function oneOrMany<T extends z.ZodRawShape>(shape: T) {
  return z.union([
    z.strictObject({ name: name.optional(), ...shape }),
    z.array(z.strictObject({ name, ...shape })).min(1),
  ])
}

/** A backend: a plain createSimpleDataProvider is built for it unless a module replaces it by name. */
export const adminDataConfigSchema = oneOrMany({
  /** API root of data requests, and of sign-in and uploads for a panel whose data it is. */
  url: z.string().min(1),
  /**
   * The server-sent event stream of backend changes, relative to `url`
   * unless absolute. With it, lists and records refetch when an event on
   * `resources/{resource}` arrives.
   */
  live: z.string().min(1).optional(),
  /** `false` sends none of the reader's credentials, and a 401 from it does not sign the reader out. */
  auth: z.boolean().optional(),
})

/** A sign-in: one session, kept and sent by the simple auth convention unless a module replaces it by name. */
export const adminAuthConfigSchema = oneOrMany({
  /**
   * `bearer` (default) keeps the token login returns and sends it as
   * `Authorization: Bearer …`; `cookie` relies on the server's session
   * cookie, sent with every request, and asks `me` who is signed in.
   */
  mode: z.enum(['bearer', 'cookie']).optional(),
  /** Bearer mode: storage key of the token; defaults to one per auth name. */
  tokenKey: z.string().min(1).optional(),
  /** Cookie mode: the anti-forgery cookie echoed in a header on writes, e.g. `{ "cookie": "XSRF-TOKEN", "header": "X-XSRF-TOKEN" }`. */
  csrf: z.strictObject({ cookie: z.string().min(1), header: z.string().min(1) }).optional(),
  /** The backend (a `data` name) its endpoints are relative to; defaults to the panel's. */
  data: name.optional(),
  /** Session endpoints, relative to that backend. */
  endpoints: z.strictObject({
    login: z.string().optional(),
    logout: z.string().optional(),
    me: z.string().optional(),
    /** Renews the session after a 401 before signing the reader out. */
    refresh: z.string().optional(),
    /** Sign-up; set it to offer "Create account". */
    register: z.string().optional(),
    /** Start of a password reset; set it to offer "Forgot password?" as a page. */
    forgotPassword: z.string().optional(),
    /** The reset link's target, setting the new password. */
    updatePassword: z.string().optional(),
  }).optional(),
})

/**
 * How menus, routes and `CanAccess` read the permissions login returns:
 * `{ "separator": "." }` turns `system/users` + `delete` into
 * `system.users.delete`; `*` covers a segment, a trailing `*` all below.
 */
export const adminAccessConfigSchema = oneOrMany({
  separator: z.enum([':', '.']).optional(),
  format: z.string().includes('{resource}').includes('{action}').optional(),
})

/**
 * Page JSON from the backend: each page `src` that is not a full URL is sent
 * as `path` (with `data` beside it) to `endpoint` through the data provider,
 * so it is signed and unwrapped like any other request. `method` defaults to
 * `POST`; `GET` sends the values as the query.
 */
export const adminPagesSourceSchema = z.strictObject({
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST']).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})
export type AdminPagesSource = z.infer<typeof adminPagesSourceSchema>

/** One back office: its path, menus, sign-in page, and which data, auth and access it uses. */
export const adminPanelConfigSchema = oneOrMany({
  /** Where it lives below `basename`; defaults to `/`. Several panels each take their own. */
  path: panelPath.optional(),
  /** The Admin manifest, or the URL that serves it. */
  manifest: z.union([z.string().min(1), adminManifestSchema]),
  /** Whether the manifest needs a signed-in reader before it loads. */
  manifestAuth: z.enum(['public', 'protected']).optional(),
  /** Theme tokens, or the URL that serves them; defaults to the root `theme`. */
  theme: z.union([z.string().min(1), themeConfigSchema]).optional(),
  login: adminLoginConfigSchema.optional(),
  /** Loads page JSON through the backend instead of as files. */
  pages: adminPagesSourceSchema.optional(),
  /** The `data` its pages use by default; other backends stay reachable by name. */
  data: name.optional(),
  /** The `auth` it signs in with. Panels naming the same one share a session. */
  auth: name.optional(),
  /** The `access` rule its menus and checks follow. */
  access: name.optional(),
  /**
   * The resource of the audit log, e.g. `audit-logs`. With it each accepted
   * write is recorded there, and AuditLog elements list it, filtered by
   * `resource` and `id`.
   */
  auditLog: z.string().min(1).optional(),
  /** Counts beside menu items, keyed by route name. */
  menuBadges: z.record(z.string(), z.strictObject({ label: z.union([z.string(), z.number()]), tone: z.enum(['neutral', 'warning']).optional() })).optional(),
  /**
   * Storage namespace of the shell: the reader's preferences, open tabs and
   * chosen language. Defaults to one per manifest `app.id`, and with several
   * panels to one per panel.
   */
  shellStorageKey: z.string().min(1).optional(),
})

type Named<T> = T extends readonly (infer Item)[] ? Item & { name: string } : T & { name: string }
export type AdminDataConfig = Named<z.infer<typeof adminDataConfigSchema>>
export type AdminAuthConfig = Named<z.infer<typeof adminAuthConfigSchema>>
export type AdminAccessConfig = Named<z.infer<typeof adminAccessConfigSchema>>
export type AdminPanelConfig = Named<z.infer<typeof adminPanelConfigSchema>>

/** The items of a one-or-many entry, the single object named `default`. */
export function adminConfigItems<T extends { name?: string | undefined }>(value: T | readonly T[] | undefined): Array<T & { name: string }> {
  if (value === undefined)
    return []
  return (Array.isArray(value) ? value : [{ ...value, name: (value as T).name ?? 'default' }]) as Array<T & { name: string }>
}

export const adminBaseConfigSchema = z.strictObject({
  /** CSS selector of the mount node; defaults to `#app`. */
  el: z.string().min(1).optional(),
  /** Where the site is served when not at the root, e.g. `/console`; every panel path is below it. */
  basename: z.string().regex(/^(?:\/[^?#\s]*)?$/, 'a path such as /console').optional(),
  /** The backends. */
  data: adminDataConfigSchema,
  /** The sign-ins; one with the default endpoints when left out. */
  auth: adminAuthConfigSchema.optional(),
  /** The permission rules; `resource:action` when left out. */
  access: adminAccessConfigSchema.optional(),
  /** The back offices this deployment serves, chosen by path. */
  panels: adminPanelConfigSchema,
  /** The panel `/` opens; defaults to the first. */
  defaultPanel: name.optional(),
  /**
   * Sites an `Iframe` element or a `page.iframe` route may show, e.g.
   * `["https://report.example.com"]`; this site always may. Without it any
   * https site may.
   */
  frameOrigins: z.array(z.url({ protocol: /^https$/ })).optional(),
  /**
   * Key of packed manifests, pages and themes. The backend may answer
   * `{ "packed": "…" }` instead of readable JSON so the text does not show in
   * the network panel; that works without any setting here, and this is the
   * key when the backend masks the packed bytes with one. It hides documents
   * from a casual look only: this file is itself readable.
   */
  packKey: z.string().min(1).optional(),
  /** Theme every panel uses unless it names its own. */
  theme: z.union([z.string().min(1), themeConfigSchema]).optional(),
  i18n: z.strictObject({
    locale: z.string().min(1),
    fallbackLocale: z.string().min(1).optional(),
    /** Per locale: translations every page shares, merged over Lumi's own, inline or by URL. A page adds its own in its `translations`. */
    translations: z.record(z.string(), messageSource).optional(),
    format: z.strictObject({
      currency: z.string().min(1),
      currencyUnit: z.enum(['major', 'minor']),
      timeZone: z.string().min(1),
      dateTimeInput: z.literal('iso-utc'),
    }).optional(),
  }).optional(),
  /**
   * Extension modules the base imports before it mounts: plain ES modules
   * whose default export receives the runtime (React, Lumi, UI, Admin, zod)
   * and returns the components, actions and callbacks they add.
   */
  modules: z.array(z.string().min(1)).optional(),
  /** Storage namespace for the manifest cache and workspace; each panel keeps its own below it. */
  cacheKey: z.string().min(1).optional(),
}).superRefine((config, context) => {
  const lists = {
    data: adminConfigItems(config.data),
    auth: adminConfigItems(config.auth),
    access: adminConfigItems(config.access),
    panels: adminConfigItems(config.panels),
  }
  for (const [key, items] of Object.entries(lists)) {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      if (seen.has(item.name))
        context.addIssue({ code: 'custom', path: [key, index, 'name'], message: `two ${key} entries are named "${item.name}"` })
      seen.add(item.name)
    })
  }
  const refer = (key: 'data' | 'auth' | 'access' | 'panels', value: string | undefined, path: (string | number)[]): void => {
    if (value !== undefined && !lists[key].some(item => item.name === value))
      context.addIssue({ code: 'custom', path, message: `no ${key} entry is named "${value}"` })
  }
  const paths = new Set<string>()
  lists.panels.forEach((panel, index) => {
    const at = Array.isArray(config.panels) ? ['panels', index] : ['panels']
    refer('data', panel.data, [...at, 'data'])
    refer('auth', panel.auth, [...at, 'auth'])
    refer('access', panel.access, [...at, 'access'])
    const path = panel.path ?? '/'
    if (paths.has(path))
      context.addIssue({ code: 'custom', path: [...at, 'path'], message: `two panels live at ${path}` })
    paths.add(path)
  })
  lists.auth.forEach((auth, index) => refer('data', auth.data, [...(Array.isArray(config.auth) ? ['auth', index] : ['auth']), 'data']))
  refer('panels', config.defaultPanel, ['defaultPanel'])
})

export type AdminBaseConfig = z.infer<typeof adminBaseConfigSchema>

/** One panel with the data, auth and access it uses, as a mount needs them. */
export interface AdminPanelSetup {
  panel: AdminPanelConfig
  /** Every backend; the panel's own is `default` to its pages. */
  data: AdminDataConfig[]
  /** The panel's backend. */
  defaultData: AdminDataConfig
  auth: AdminAuthConfig
  access: AdminAccessConfig
  /** Router base of the panel: `basename` joined with its path. */
  basename: string
}

const TRAILING_SLASHES_RE = /\/+$/

/** Pick by name, else `default`, else the first. */
function pick<T extends { name: string }>(items: T[], wanted: string | undefined): T | undefined {
  return wanted !== undefined ? items.find(item => item.name === wanted) : items.find(item => item.name === 'default') ?? items[0]
}

/**
 * The panel a page shows: the one named `panel` when given (a page of its
 * own), else the one whose path holds `pathname` (the longest wins), else the
 * default panel.
 */
export function selectAdminPanel(config: AdminBaseConfig, pathname: string, panel?: string): AdminPanelSetup {
  const panels = adminConfigItems(config.panels)
  const root = (config.basename ?? '').replace(TRAILING_SLASHES_RE, '')
  const inside = pathname.startsWith(root) ? pathname.slice(root.length) || '/' : pathname
  const holds = (path: string): boolean => path === '/' || inside === path || inside.startsWith(`${path}/`)
  const chosen = panel !== undefined
    ? panels.find(item => item.name === panel)
    : panels
      .filter(item => holds(item.path ?? '/'))
      .sort((a, b) => (b.path ?? '/').length - (a.path ?? '/').length)[0]
      ?? pick(panels, config.defaultPanel)
  if (!chosen)
    throw new Error(`[lumi] no panel is named "${panel}"`)
  const data = adminConfigItems(config.data)
  const defaultData = pick(data, chosen.data)!
  const auths = adminConfigItems(config.auth)
  const accesses = adminConfigItems(config.access)
  const path = chosen.path ?? '/'
  return {
    panel: chosen,
    data,
    defaultData,
    auth: pick(auths, chosen.auth) ?? { name: 'default' },
    access: pick(accesses, chosen.access) ?? { name: 'default' },
    basename: path === '/' ? root : `${root}${path}`,
  }
}
