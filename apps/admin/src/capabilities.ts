// Single source of the showcase: the menu, planned
// pages and the sidebar coverage card are all derived from this list.

export type CapabilityStatus = 'complete' | 'align' | 'planned'
export type CapabilityLayer = 'lumi' | 'lumi-ui' | 'lumi-admin'

export interface CapabilityModule {
  name: string
  label: string
  icon: string
}

export interface CapabilityGroup {
  name: string
  label: string
  module: CapabilityModule
}

export interface Capability {
  /** Route name; also the menu badge key. */
  name: string
  label: string
  /** Menu entry and route path. */
  path: string
  icon: string
  group: CapabilityGroup
  layers: readonly CapabilityLayer[]
  status: CapabilityStatus
  summary: string
  /** Route component; planned entries render the shared planned page. */
  component?: string
  /** JSON page under `public/pages`, served as a file and rendered from the catalog. */
  spec?: string
  /** Planned scope shown on the placeholder page. */
  plan?: readonly string[]
}

/** Capabilities reached from another page rather than their own menu entry. */
export interface LinkedCapability {
  label: string
  /** Concrete URL opened from the overview. */
  href: string
  group: CapabilityGroup
  layers: readonly CapabilityLayer[]
  status: CapabilityStatus
  summary: string
}

// Modules follow an admin template's navigation — what a reader is looking
// for, not which package provides it: dashboards, interface components, forms,
// data pages, ready-made pages, shell layout, then developer topics. Interface
// pages are JSON files under public/pages, one per category with every variant.
const start = { name: 'overview', label: 'Dashboards', icon: 'layout-dashboard' }
const components = { name: 'ui', label: 'Interface', icon: 'blocks' }
const forms = { name: 'forms', label: 'Forms', icon: 'square-pen' }
const data = { name: 'data', label: 'Data', icon: 'table' }
const app = { name: 'app', label: 'Pages', icon: 'file-text' }
const layout = { name: 'layout', label: 'Layout', icon: 'panels-top-left' }
const json = { name: 'json', label: 'Developer', icon: 'files' }
const assistant = { name: 'assistant', label: 'Assistant', icon: 'sparkles' }

export const CAPABILITY_MODULES = [start, assistant, components, forms, data, app, layout, json] as const

const g = {
  dashboards: { name: 'dashboards', label: 'Dashboards', module: start },
  chats: { name: 'chats', label: 'Assistant', module: assistant },
  // Leads the module like the Dashboards group: the overview opens every category below.
  interface: { name: 'interface', label: 'Interface', module: components },
  basics: { name: 'basics', label: 'Basics', module: components },
  feedback: { name: 'feedback', label: 'Feedback', module: components },
  surfaces: { name: 'surfaces', label: 'Surfaces & navigation', module: components },
  display: { name: 'display', label: 'Data display', module: components },
  agent: { name: 'agent', label: 'AI', module: components },
  elements: { name: 'elements', label: 'Form elements', module: forms },
  forms: { name: 'forms', label: 'Form layouts', module: forms },
  lists: { name: 'lists', label: 'Lists', module: data },
  details: { name: 'details', label: 'Records & overlays', module: data },
  account: { name: 'account', label: 'Account & access', module: app },
  settings: { name: 'settings', label: 'Settings', module: app },
  states: { name: 'states', label: 'Results & errors', module: app },
  shell: { name: 'shell', label: 'App shell', module: layout },
  json: { name: 'json', label: 'JSON rendering', module: json },
  hooks: { name: 'hooks', label: 'Headless hooks', module: json },
  backend: { name: 'backend', label: 'Backend contract', module: json },
  ai: { name: 'ai', label: 'AI integration', module: json },
} satisfies Record<string, CapabilityGroup>

export const CAPABILITIES: readonly Capability[] = [
  { name: 'dashboard', label: 'Operations dashboard', path: '/', icon: 'chart-bar', group: g.dashboards, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminDashboardRoute', summary: 'Aggregates, periods and charts composed into a full dashboard.' },
  { name: 'dashboard-sales', label: 'Sales analytics', path: '/dashboards/sales', icon: 'chart-line', group: g.dashboards, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', spec: 'dashboard-sales.json', summary: 'Revenue, channels, conversion and the latest orders, as a JSON page with live order data.' },
  { name: 'dashboard-projects', label: 'Project overview', path: '/dashboards/projects', icon: 'folder-kanban', group: g.dashboards, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', spec: 'dashboard-projects.json', summary: 'Projects, milestones, team load and activity, as a JSON page with live project data.' },
  { name: 'boards', label: 'Boards & calendar', path: '/dashboards/boards', icon: 'calendar', group: g.dashboards, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', spec: 'boards.json', summary: 'A Kanban board that saves moves with update, and a month and week schedule, both fed by Query.' },
  { name: 'workbench', label: 'Workbench', path: '/workbench', icon: 'clipboard-list', group: g.dashboards, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminWorkbenchRoute', summary: 'Tasks, activity and shortcuts driven by live data.' },

  { name: 'assistant', label: 'Chats', path: '/assistant', icon: 'sparkles', group: g.chats, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', spec: 'assistant.json', summary: 'A full-page agent workspace over the mock agent: conversations in the second column, a streamed thread with tool calls and approvals, and the composer.' },

  { name: 'ui-overview', label: 'Component overview', path: '/ui/overview', icon: 'blocks', group: g.interface, layers: ['lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminComponentOverviewRoute', summary: 'Every component as a live thumbnail, searchable and filtered by category; each card opens its demo.' },
  { name: 'ui-buttons', label: 'Buttons', path: '/ui/buttons', icon: 'square-plus', group: g.basics, layers: ['lumi-ui'], status: 'complete', spec: 'buttons.json', summary: 'Every appearance, size, shape and state, with icons and links.' },
  { name: 'ui-badges', label: 'Badges & avatars', path: '/ui/badges', icon: 'tag', group: g.basics, layers: ['lumi-ui'], status: 'complete', spec: 'badges.json', summary: 'Badges in every tone and appearance, avatars, avatar groups and icons.' },
  { name: 'ui-typography', label: 'Typography', path: '/ui/typography', icon: 'type', group: g.basics, layers: ['lumi-ui'], status: 'complete', spec: 'typography.json', summary: 'Headings, text variants, code blocks and separators.' },
  { name: 'ui-code', label: 'Code', path: '/ui/code', icon: 'source-code', group: g.basics, layers: ['lumi-ui'], status: 'complete', spec: 'code.json', summary: 'Highlighted code blocks with file names, line numbers, marked lines and tabs, and a code editor bound to page state with JSON checking.' },
  { name: 'ui-content', label: 'Rich content', path: '/ui/content', icon: 'file-01', group: g.basics, layers: ['lumi-ui', 'lumi-admin'], status: 'complete', spec: 'content.json', summary: 'Long-form typesetting, Markdown, sanitized HTML and a full article view with a contents list.' },
  { name: 'ui-alerts', label: 'Alerts & progress', path: '/ui/alerts', icon: 'bell', group: g.feedback, layers: ['lumi-ui'], status: 'complete', spec: 'alerts.json', summary: 'Alerts in every tone, progress bars and empty, error and permission states.' },
  { name: 'ui-modals', label: 'Modals & drawers', path: '/ui/modals', icon: 'layers', group: g.feedback, layers: ['lumi-ui'], status: 'complete', spec: 'modals.json', summary: 'Dialogs and drawers opened through page state.' },
  { name: 'ui-toasts', label: 'Toasts & notifications', path: '/ui/toasts', icon: 'bell-ring', group: g.feedback, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', spec: 'toasts.json', summary: 'Top-centre toasts from the toast action, including automatic request errors, and top-right notice cards from the notify action with actions, sticky mode and keyed updates.' },
  { name: 'ui-feedback-display', label: 'Status & display', path: '/ui/feedback-display', icon: 'loading-03', group: g.feedback, layers: ['lumi-ui'], status: 'complete', spec: 'feedback-display.json', summary: 'Skeletons, spinners, empty states, keyboard keys, scroll areas, tags, an inline calendar and a listbox bound to page state.' },
  { name: 'ui-menus', label: 'Menus, tooltips & accordion', path: '/ui/menus', icon: 'menu-square', group: g.surfaces, layers: ['lumi-ui'], status: 'complete', spec: 'menus.json', summary: 'Dropdown menus wired to actions, tooltips on icon buttons and folding sections.' },
  { name: 'ui-overlays-media', label: 'Overlays & media', path: '/ui/overlays-media', icon: 'image', group: g.surfaces, layers: ['lumi-ui'], status: 'complete', spec: 'overlays-media.json', summary: 'Popovers, confirm bubbles, images with a full-screen viewer and carousels wired to actions.' },
  { name: 'ui-cards', label: 'Cards', path: '/ui/cards', icon: 'square-stack', group: g.surfaces, layers: ['lumi-ui'], status: 'complete', spec: 'cards.json', summary: 'Card, frame and dashboard tile surfaces with icons, header actions and links.' },
  { name: 'ui-navigation', label: 'Tabs & steps', path: '/ui/navigation', icon: 'panels-top-left', group: g.surfaces, layers: ['lumi-ui'], status: 'complete', spec: 'navigation.json', summary: 'Tabs, segmented control, steppers, breadcrumbs and pagination bound to state.' },
  { name: 'ui-tables', label: 'Tables', path: '/ui/tables', icon: 'table', group: g.display, layers: ['lumi-ui'], status: 'complete', spec: 'tables.json', summary: 'Every column kind, selection, totals, empty and loading tables; description lists.' },
  { name: 'ui-lists', label: 'Lists & timeline', path: '/ui/lists', icon: 'list', group: g.display, layers: ['lumi-ui'], status: 'complete', spec: 'lists.json', summary: 'Timelines, activity feeds, record lists, proportions and pipelines.' },
  { name: 'ui-charts', label: 'Charts', path: '/ui/charts', icon: 'chart-bar', group: g.display, layers: ['lumi-ui'], status: 'complete', component: 'AdminChartsRoute', summary: 'Area, line, bar and donut charts with accessible tables.' },
  { name: 'ui-stats', label: 'Stats & metrics', path: '/ui/stats', icon: 'activity', group: g.display, layers: ['lumi-admin'], status: 'complete', component: 'AdminStatsRoute', summary: 'Stat cards, metric icons and units, matrix trend and period control as a gallery.' },
  { name: 'ui-ai', label: 'AI components', path: '/ui/ai', icon: 'sparkles', group: g.agent, layers: ['lumi-ui'], status: 'complete', spec: 'ai-components.json', summary: 'Chat thread, prompt input, messages with citations, thinking, tool calls, approvals, plans, changes and context, bound to page state and actions.' },

  { name: 'form-elements', label: 'Form elements', path: '/forms/elements', icon: 'list', group: g.elements, layers: ['lumi-ui'], status: 'complete', spec: 'form-elements.json', summary: 'Every form control in its sizes, appearances and states on one page.' },
  { name: 'form-controls-plus', label: 'More form controls', path: '/forms/controls-plus', icon: 'star', group: g.elements, layers: ['lumi', 'lumi-ui'], status: 'complete', spec: 'form-controls-plus.json', summary: 'Slider, choice cards, tag select, rating, color and icon pickers, one-time codes, masks and signatures submitted from one form.' },
  { name: 'async-tree', label: 'Trees & pickers', path: '/forms/async-tree', icon: 'workflow', group: g.elements, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', spec: 'async-tree.json', summary: 'Tree, TreeSelect, Cascader and CascaderPanel on static and remote nodes with lazy levels, a list filtered by a side tree, and record pickers' },
  { name: 'async-select', label: 'Remote options', path: '/forms/async-select', icon: 'search', group: g.elements, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', spec: 'async-select.json', summary: 'Select and MultiSelect on a resource with search, paging, echo of preselected ids and rich options; linked region levels, AutoComplete, Mention and Transfer.' },
  { name: 'upload-form', label: 'Upload', path: '/forms/upload', icon: 'upload', group: g.elements, layers: ['lumi', 'lumi-ui'], status: 'complete', component: 'AdminUploadRoute', summary: 'Upload service with progress, cancellation and retry.' },
  { name: 'basic-form', label: 'Basic form', path: '/examples/forms/basic', icon: 'square-pen', group: g.forms, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminBasicFormRoute', summary: 'Field validation, save/reset and unsaved-change protection.' },
  { name: 'repeater-form', label: 'Repeater & SKU editor', path: '/forms/repeater', icon: 'table', group: g.forms, layers: ['lumi-ui', 'lumi-admin'], status: 'complete', spec: 'form-repeater.json', summary: 'Order lines with totals, contact cards and a product variant matrix over state arrays' },
  { name: 'product-form', label: 'Step form', path: '/products/new', icon: 'workflow', group: g.forms, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminProductFormRoute', summary: 'Per-step validation with a live summary.' },
  { name: 'project-form', label: 'Tabbed form', path: '/projects/new', icon: 'panels-top-left', group: g.forms, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminProjectFormRoute', summary: 'Sections in tabs sharing one draft; creates or edits a project, then returns to the list.' },
  { name: 'article-form', label: 'Publishing form', path: '/articles/new', icon: 'pen-line', group: g.forms, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminArticleFormRoute', summary: 'Long content, an uploaded cover and publishing metadata with draft protection; creates or edits.' },
  { name: 'settings-profile', label: 'Account settings', path: '/settings/profile', icon: 'sliders-horizontal', group: g.settings, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminSettingsRoute', summary: 'Profile, notifications, regional, workspace and security settings, each section saved on its own.' },

  { name: 'products', label: 'Standard list', path: '/products', icon: 'package', group: g.lists, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminProductsRoute', summary: 'Pagination, sorting, column settings, selection and row actions.' },
  { name: 'customers-crud', label: 'CRUD', path: '/customers/crud', icon: 'user-edit-01', group: g.lists, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', spec: 'crud.json', summary: 'The CRUD guide\'s JSON page: a search box, a shared create and edit dialog, inline Edit and Delete buttons per row and server field errors.' },
  { name: 'orders', label: 'Filters & bulk actions', path: '/orders', icon: 'shopping-cart', group: g.lists, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminOrdersRoute', summary: 'Filter presets with counts, advanced filters and a selection toolbar.' },
  { name: 'article-search', label: 'Search results', path: '/articles/search', icon: 'search', group: g.lists, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminArticleSearchRoute', summary: 'Search-result cards with descriptions and metadata; each hit opens the article.' },
  { name: 'project-cards', label: 'Card list', path: '/projects/cards', icon: 'layout-grid', group: g.lists, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminProjectCardsRoute', summary: 'Responsive cards with filters and pagination; each card opens the project.' },
  { name: 'customers', label: 'Customers', path: '/customers', icon: 'users', group: g.details, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminCustomersRoute', summary: 'A record list with routed edit and related-orders drawers.' },

  { name: 'account-center', label: 'Account center', path: '/account/center', icon: 'user', group: g.account, layers: ['lumi-admin'], status: 'complete', component: 'AdminAccountCenterRoute', summary: 'Profile information and activity feed.' },
  { name: 'users', label: 'Users', path: '/users', icon: 'user', group: g.account, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminUsersRoute', summary: 'User identities, roles and account status: create and edit in a routed drawer, suspend with confirmation.' },
  { name: 'roles', label: 'Roles', path: '/roles', icon: 'shield', group: g.account, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminRolesRoute', summary: 'Roles as resource:action codes edited per resource; the access provider enforces them.' },
  { name: 'auth-permissions', label: 'Route & action access', path: '/auth/permissions', icon: 'lock', group: g.account, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminPermissionsRoute', summary: 'Route guards and action-level access per signed-in role.' },
  { name: 'result-success', label: 'Result · success', path: '/result/success', icon: 'circle-check', group: g.states, layers: ['lumi-admin'], status: 'complete', component: 'AdminResultSuccessRoute', summary: 'Confirmation with links to the next task.' },
  { name: 'result-fail', label: 'Result · failure', path: '/result/fail', icon: 'circle-x', group: g.states, layers: ['lumi-admin'], status: 'complete', component: 'AdminResultFailRoute', summary: 'Failure with recovery actions.' },
  { name: 'state-examples', label: 'Loading, empty & error', path: '/examples/states', icon: 'activity', group: g.states, layers: ['lumi-admin'], status: 'complete', component: 'AdminStatesRoute', summary: 'Recoverable loading, empty, error, offline and timeout states.' },
  { name: 'exception-403', label: '403 Forbidden', path: '/exception/403', icon: 'lock', group: g.states, layers: ['lumi-admin'], status: 'complete', component: 'AdminException403Route', summary: 'Access denied.' },
  { name: 'exception-404', label: '404 Not found', path: '/exception/404', icon: 'file-question', group: g.states, layers: ['lumi-admin'], status: 'complete', component: 'AdminException404Route', summary: 'A missing page or record.' },
  { name: 'exception-500', label: '500 Server error', path: '/exception/500', icon: 'triangle-alert', group: g.states, layers: ['lumi-admin'], status: 'complete', component: 'AdminException500Route', summary: 'A server failure with a retry path.' },

  { name: 'shell-layout', label: 'Layout, menu & badges', path: '/shell/layout', icon: 'panels-top-left', group: g.shell, layers: ['lumi-admin'], status: 'complete', component: 'AdminShellLayoutRoute', summary: 'Manifest modules, groups, badges, tabs and the sidebar footer slot, with live useShell state.' },
  { name: 'shell-theme', label: 'Theme & dark mode', path: '/shell/theme', icon: 'sun', group: g.shell, layers: ['lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminShellThemeRoute', summary: 'A validated theme document, scoped preview, derived CSS variables and the app colour mode.' },

  { name: 'json-start', label: 'Getting started', path: '/json/start', icon: 'book-open', group: g.json, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminJsonStartRoute', summary: 'Spec structure, rendering with json-render alone, adding Lumi services, $t and an Admin route.' },
  { name: 'json-state', label: 'State binding', path: '/json/state', icon: 'sliders-horizontal', group: g.json, layers: ['lumi', 'lumi-ui'], status: 'complete', component: 'AdminJsonStateRoute', summary: '$state, $bindState, visible, $cond, $template, repeat and watch, each beside its live result.' },
  { name: 'json-actions', label: 'Actions & requests', path: '/json/actions', icon: 'zap', group: g.json, layers: ['lumi', 'lumi-ui'], status: 'complete', component: 'AdminJsonActionsRoute', summary: 'setState, array actions, toast and notify, request, mutations and submitForm.' },
  { name: 'json-query', label: 'Data queries', path: '/json/query', icon: 'layout-list', group: g.json, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminJsonQueryRoute', summary: 'Query for filtered lists, pages and sorting, master and detail, and a list with its totals.' },
  { name: 'json-catalog', label: 'Catalog validation', path: '/json/catalog', icon: 'list-checks', group: g.json, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminJsonCatalogRoute', summary: 'The application Catalog, live Spec validation, lumi-check output and a custom component.' },
  { name: 'json-playground', label: 'Playground', path: '/json/playground', icon: 'square-pen', group: g.json, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', component: 'AdminJsonPlaygroundRoute', summary: 'Edit a Spec and see it render, validated as you type.' },
  { name: 'hooks-data', label: 'Data hooks', path: '/hooks/data', icon: 'database', group: g.hooks, layers: ['lumi'], status: 'complete', component: 'AdminHooksDataRoute', summary: 'useList, useOne, useMany, useInfiniteList, the write hooks with optimistic and undoable modes, useCustom and useInvalidate.' },
  { name: 'hooks-lists', label: 'Tables, selects & forms', path: '/hooks/lists', icon: 'table', group: g.hooks, layers: ['lumi', 'lumi-ui'], status: 'complete', component: 'AdminHooksListsRoute', summary: 'useTable with URL sync, useSelect with remote search, useForm with validation and useTreeSource, each driving plain Lumi UI.' },
  { name: 'hooks-live', label: 'Live, tenants & access', path: '/hooks/live', icon: 'activity', group: g.hooks, layers: ['lumi'], status: 'complete', component: 'AdminHooksLiveRoute', summary: 'useSubscription and usePublish, useTenant, useCan, usePermissions and useIdentity.' },
  { name: 'hooks-transfer', label: 'Import, export & history', path: '/hooks/transfer', icon: 'file-text', group: g.hooks, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminHooksTransferRoute', summary: 'useExport and useImport with CSV and JSON, and useAuditLogList over the audit log.' },
  { name: 'hooks-app', label: 'App & shell hooks', path: '/hooks/app', icon: 'panels-top-left', group: g.hooks, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminHooksAppRoute', summary: 'Toasts, notices and dialogs, translation and formatting, navigation, and the Admin hooks: useShell, useDocumentTitle, useAssistantContext, useAdminDrawer and the unsaved-changes guard.' },
  { name: 'backend-spec', label: 'Served pages', path: '/backend/spec', icon: 'globe', group: g.backend, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminBackendSpecRoute', summary: 'A Go handler serves the page Spec; the front end validates and renders it.' },
  { name: 'backend-data', label: 'Data API', path: '/backend/data', icon: 'database', group: g.backend, layers: ['lumi'], status: 'complete', component: 'AdminBackendDataRoute', summary: 'The REST contract of createSimpleDataProvider, sent live to the mock API.' },
  { name: 'backend-errors', label: 'Error handling', path: '/backend/errors', icon: 'triangle-alert', group: g.backend, layers: ['lumi', 'lumi-admin'], status: 'complete', component: 'AdminBackendErrorsRoute', summary: '422 field errors, 401, 403 and 5xx, Query error states and automatic toasts.' },
  { name: 'backend-auth', label: 'Auth API', path: '/backend/auth', icon: 'key-round', group: g.backend, layers: ['lumi'], status: 'complete', component: 'AdminBackendAuthRoute', summary: 'Login, session restore, permission codes and provider configuration.' },
  { name: 'ai-agent', label: 'Agent panel', path: '/ai/agent', icon: 'sparkles', group: g.ai, layers: ['lumi-admin'], status: 'complete', component: 'AdminAgentRoute', summary: 'The Shell assistant slot, model output validated before rendering and a prompt from the Catalog.' },
  { name: 'ai-commands', label: 'Author commands', path: '/ai/commands', icon: 'source-code', group: g.ai, layers: ['lumi'], status: 'complete', component: 'AdminAuthorCommandsRoute', summary: 'The lumi-check commands a coding agent runs: catalog, describe and validation.' },
]

export const LINKED_CAPABILITIES: readonly LinkedCapability[] = [
  { label: 'Edit form', href: '/products/1/edit', group: g.forms, layers: ['lumi', 'lumi-admin'], status: 'complete', summary: 'Loads a record, tracks dirty state and saves with a status indicator.' },
  { label: 'Detail page', href: '/orders/1', group: g.details, layers: ['lumi', 'lumi-ui', 'lumi-admin'], status: 'complete', summary: 'Items, totals, customer context and a timeline.' },
  { label: 'Record detail', href: '/products/1', group: g.details, layers: ['lumi', 'lumi-admin'], status: 'complete', summary: 'Properties, related information and record actions.' },
  { label: 'Routed drawer', href: '/customers?drawer=edit-customer&record=1', group: g.details, layers: ['lumi-admin'], status: 'complete', summary: 'Edit without leaving the list; unsaved changes are guarded.' },
  { label: 'Drawer table', href: '/customers?drawer=customer-orders&record=1', group: g.details, layers: ['lumi', 'lumi-admin'], status: 'complete', summary: 'Search and paginate related records inside a drawer.' },
  { label: 'Content list', href: '/articles', group: g.lists, layers: ['lumi', 'lumi-admin'], status: 'complete', summary: 'Articles with status, publish/unpublish, a modal category form and row-to-editor navigation.' },
  { label: 'Project list', href: '/projects', group: g.lists, layers: ['lumi', 'lumi-admin'], status: 'complete', summary: 'Project table that opens the tabbed editor; card view lives at Card list.' },
]

/** Routes reached from other pages; kept out of the menu. */
export const HIDDEN_ROUTES = [
  { name: 'product-detail', path: '/products/:id', label: 'Product detail', component: 'AdminProductDetailRoute', group: g.lists },
  { name: 'product-edit', path: '/products/:id/edit', label: 'Edit product', component: 'AdminProductEditRoute', group: g.lists },
  { name: 'project-edit', path: '/projects/:id/edit', label: 'Edit project', component: 'AdminProjectFormRoute', group: g.forms },
  { name: 'article-edit', path: '/articles/:id/edit', label: 'Edit article', component: 'AdminArticleFormRoute', group: g.forms },
  { name: 'order-detail', path: '/orders/:id', label: 'Order detail', component: 'AdminOrderDetailRoute', group: g.lists },
  { name: 'articles', path: '/articles', label: 'Articles', component: 'AdminArticlesRoute', group: g.lists },
  { name: 'projects', path: '/projects', label: 'Projects', component: 'AdminProjectsRoute', group: g.lists },
] as const

export const STATUS_LABEL: Record<CapabilityStatus, string> = {
  complete: 'Complete',
  align: 'Needs alignment',
  planned: 'Planned',
}

export function capabilityCoverage(): { complete: number, align: number, planned: number, total: number } {
  const all = [...CAPABILITIES, ...LINKED_CAPABILITIES]
  const count = (status: CapabilityStatus): number => all.filter(item => item.status === status).length
  return { complete: count('complete'), align: count('align'), planned: count('planned'), total: all.length }
}
