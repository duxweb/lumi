import type { TextValue } from '@duxweb/lumi-ui'
import type { AdminApp, AdminLayout, AdminMenuItem, AdminWorkspace } from '../catalog.js'

export interface AdminIdentity {
  id?: string | number
  name?: string
  email?: string
  role?: string
}

export type LumiAdminMenuItem = AdminMenuItem

export interface LumiAdminMenuGroup {
  name: string
  label: TextValue
  icon?: string
  items: LumiAdminMenuItem[]
}

export interface LumiAdminModule {
  name: string
  label: TextValue
  icon?: string
  groups: LumiAdminMenuGroup[]
}

export type ShellColorModePreference = 'light' | 'dark' | 'system'

export interface ShellBreadcrumb {
  key: string
  label: string
  path?: string
}

export interface ShellTab {
  key: string
  path: string
  label: string
  closable: boolean
}

export interface ShellContextValue {
  app: Pick<AdminApp, 'id' | 'title' | 'subtitle' | 'logo' | 'layout' | 'tabs' | 'header'> & {
    title: string
    layout: AdminLayout
    /** Where the menu search sits; the sidebar head shows the workspace otherwise. */
    search: 'sidebar' | 'header' | 'none'
  }
  /** The workspaces the sidebar head switches between; a switcher from two up. */
  workspace: {
    options: readonly AdminWorkspace[]
    current?: AdminWorkspace
    select: (value: string) => void
  }
  menu: readonly LumiAdminMenuItem[]
  groups: readonly LumiAdminMenuGroup[]
  modules: readonly LumiAdminModule[]
  active: {
    pathname: string
    item?: LumiAdminMenuItem
    group?: LumiAdminMenuGroup
    module?: LumiAdminModule
    breadcrumbs: readonly ShellBreadcrumb[]
  }
  navigation: {
    query: string
    collapsed: boolean
    mobileOpen: boolean
    setQuery: (value: string) => void
    toggleCollapsed: () => void
    openMobile: () => void
    closeMobile: () => void
    navigate: (path: string) => void
  }
  /** The host-provided assistant panel beside the page; `available` is false when the host supplies none. */
  assistant: {
    available: boolean
    open: boolean
    toggle: () => void
  }
  tabs: {
    enabled: boolean
    items: readonly ShellTab[]
    activeKey?: string
    activate: (key: string) => void
    close: (key: string) => void
    closeOthers: (key: string) => void
    closeAll: () => void
    reload: (key: string) => void
  }
  identity: {
    value?: AdminIdentity
    pending: boolean
    error?: unknown
  }
  /** The active language and those the app offers; `set` persists the choice. */
  locale: {
    value: string
    options: readonly { value: string, label: string }[]
    set: (locale: string) => void
  }
  colorMode: {
    preference: ShellColorModePreference
    resolved: Exclude<ShellColorModePreference, 'system'>
    set: (value: ShellColorModePreference) => void
    toggle: () => void
  }
  auth: {
    available: boolean
    pending: boolean
    error?: unknown
    logout: () => Promise<void>
  }
}
