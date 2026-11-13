import type { LumiAdminMenuGroup, LumiAdminMenuItem, LumiAdminModule } from './types.js'

const DEFAULT_GROUP = { name: 'workspace', label: 'Workspace', icon: 'layout-grid' }
const DEFAULT_MODULE = { name: 'workspace', label: 'Workspace', icon: 'layout-grid' }

/** Menu items gathered into their groups, in the order the groups first appear. */
export function groupMenu(items: LumiAdminMenuItem[]): LumiAdminMenuGroup[] {
  const order: string[] = []
  const groups = new Map<string, LumiAdminMenuGroup>()

  for (const item of items) {
    const meta = item.group ?? DEFAULT_GROUP
    let group = groups.get(meta.name)
    if (!group) {
      group = { name: meta.name, label: meta.label, icon: meta.icon, items: [] }
      groups.set(meta.name, group)
      order.push(meta.name)
    }
    group.items.push(item)
  }

  return order.map(name => groups.get(name)!)
}

/** Menu items gathered into the modules of a dual layout, each with its grouped items. */
export function buildModules(items: LumiAdminMenuItem[]): LumiAdminModule[] {
  const order: string[] = []
  const modules = new Map<string, { meta: NonNullable<LumiAdminMenuItem['module']>, items: LumiAdminMenuItem[] }>()

  for (const item of items) {
    const meta = item.module ?? DEFAULT_MODULE
    let module = modules.get(meta.name)
    if (!module) {
      module = { meta, items: [] }
      modules.set(meta.name, module)
      order.push(meta.name)
    }
    module.items.push(item)
  }

  return order.map((name) => {
    const module = modules.get(name)!
    return { name: module.meta.name, label: module.meta.label, icon: module.meta.icon, groups: groupMenu(module.items) }
  })
}
