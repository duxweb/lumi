import type { AdminManifest } from '@duxweb/lumi-admin/catalog'
import type { CapabilityGroup } from './capabilities.js'
import { CAPABILITIES, HIDDEN_ROUTES } from './capabilities.js'

const ROUTE_ACCESS: Readonly<Record<string, { resource: string, action: string }>> = {
  'product-form': { resource: 'products', action: 'create' },
}

function page(component: string): AdminManifest['routes'][number]['page'] {
  return { spec: { root: 'page', elements: { page: { type: component, props: {}, children: [] } } } }
}

/** A JSON page in `public/pages`, fetched like the base fetches any page. */
function jsonPage(file: string): AdminManifest['routes'][number]['page'] {
  return { src: `${import.meta.env.BASE_URL}pages/${file}` }
}

/** The showcase translates by English label; see `i18n.ts`. */
const labelled = <T extends { label: string }>(item: T): T & { labelKey: string } => ({ ...item, labelKey: `demo.${item.label}` })

function menuGroup(group: CapabilityGroup): { module: CapabilityGroup['module'] & { labelKey: string }, group: { name: string, label: string, labelKey: string } } {
  return { module: labelled(group.module), group: labelled({ name: group.name, label: group.label }) }
}

function shellSearchPlacement(): 'sidebar' | 'header' | 'none' {
  const value = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('search')
  return value === 'header' || value === 'none' ? value : 'sidebar'
}

export function createAdminManifest(): AdminManifest {
  return {
    app: {
      id: 'lumi-admin',
      title: 'Lumi',
      subtitle: 'Framework showcase',
      subtitleKey: 'demo.Framework showcase',
      locales: [
        { value: 'en-US', label: 'English' },
        { value: 'zh-CN', label: '简体中文' },
      ],
      layout: 'dual',
      tabs: true,
      // The sidebar head is the menu search by default; `?search=header` moves
      // the search to the header and shows the workspace switcher instead.
      search: shellSearchPlacement(),
      workspaces: [
        { value: 'showcase', label: 'Lumi', description: 'Framework showcase' },
        { value: 'staging', label: 'Lumi Staging', description: 'Pre-release checks' },
        { value: 'retail', label: 'Dux Retail', description: 'Production store' },
      ],
      // The Shell's assistant, as a backend would serve it: the endpoint, the @
      // tabs (one DataProvider resource each) and the / commands. Labels are
      // translated, so they can be message keys.
      assistant: {
        endpoint: '/agent/chat',
        title: 'Agent',
        // Pages get the full width; the panel opens from the header.
        defaultOpen: false,
        suggestions: [
          { id: 'late', label: 'Which orders are late this week?', icon: 'package' },
          { id: 'remind', label: 'Remind the late customers', icon: 'mail' },
        ],
        mentions: {
          types: [
            { value: 'orders', label: 'Orders', icon: 'shopping-bag-01' },
            { value: 'customers', label: 'Customers', icon: 'user' },
          ],
          sources: {
            orders: { resource: 'orders', labelField: 'number', descriptionField: 'customer', searchField: 'searchText', pageSize: 8 },
            customers: { resource: 'customers', labelField: 'name', descriptionField: 'email', searchField: 'name', pageSize: 8 },
          },
        },
        commands: [
          { value: 'late', label: 'Find late orders', description: 'Paid orders unshipped after 24 hours', icon: 'package', prompt: 'Which orders are late this week?' },
          { value: 'remind', label: 'Remind late customers', description: 'Asks before anything is sent', icon: 'mail-01', prompt: 'Remind the late customers' },
        ],
      },
      header: {
        actions: [
          { name: 'notifications', label: 'Notifications', labelKey: 'demo.Notifications', icon: 'bell', drawer: 'notifications' },
        ],
      },
    },
    routes: [
      ...CAPABILITIES.map((item, index) => ({
        name: item.name,
        path: item.path,
        ...(ROUTE_ACCESS[item.name] ? { access: ROUTE_ACCESS[item.name] } : {}),
        page: item.spec ? jsonPage(item.spec) : page(item.component ?? 'AdminPlannedRoute'),
        menu: { ...labelled({ label: item.label }), icon: item.icon, order: index * 10, ...menuGroup(item.group) },
      })),
      ...HIDDEN_ROUTES.map((item, index) => ({
        name: item.name,
        path: item.path,
        page: page(item.component),
        menu: { ...labelled({ label: item.label }), hidden: true, order: 1000 + index, ...menuGroup(item.group) },
      })),
    ],
  }
}
