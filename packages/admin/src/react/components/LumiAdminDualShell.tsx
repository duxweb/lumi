import type { PropsWithChildren, ReactElement } from 'react'
import { useTranslate } from '@duxweb/lumi'
import { useShell, useShellSidebarFooter } from './ShellContext.js'
import { useShellContextPanelHost } from './ShellContextPanel.js'
import {
  ShellAccountMenu,
  ShellAssistantDivider,
  ShellAssistantPanel,
  ShellAssistantToggle,
  ShellBrand,
  ShellHeaderEnd,
  ShellIconButton,
  ShellMain,
  ShellMenuGroup,
  ShellMobileButton,
  ShellMobileNavigation,
  ShellModuleEntry,
  ShellNoResults,
  ShellSearch,
  ShellSidebarSearch,
  ShellTabs,
  ShellThemeToggle,
  ShellWorkspace,
  useFilteredGroups,
  useShellText,
} from './ShellParts.js'

export interface LumiAdminDualShellProps extends PropsWithChildren {}

/** The shell with a module rail beside the menu sidebar. */
export function LumiAdminDualShell({ children }: LumiAdminDualShellProps): ReactElement {
  const shell = useShell()
  const translate = useTranslate()
  const text = useShellText()
  const sidebarFooter = useShellSidebarFooter()
  const contextPanel = useShellContextPanelHost()
  const activeGroups = useFilteredGroups(shell.active.module?.groups ?? shell.groups)
  const activeModuleLabel = shell.active.module ? text(shell.active.module.label) : shell.app.title

  return (
    // Shell wrappers clip instead of hiding overflow: a hidden box is still a scroll container, so
    // scrollIntoView and fragment navigation would scroll it and offset the whole shell. Only main scrolls.
    <div data-lumi-shell data-layout="dual" className="lumi-page lumi-shell-frame fixed inset-0 flex overflow-clip text-foreground">
      <aside aria-label={translate('lumi.admin.modules', undefined, 'Modules')} className="lumi-shell-column lumi-shell-dual-rail w-14 shrink-0 flex-col items-center gap-1 py-1">
        <ShellBrand className="mb-3 size-8 rounded-lg text-label" />
        <div className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto">{shell.modules.map(module => <ShellModuleEntry key={module.name} module={module} />)}</div>
        {/* Personal controls sit at the rail's foot; the header keeps page tools. */}
        <div className="flex shrink-0 flex-col items-center gap-2 pt-2">
          <ShellThemeToggle testId="admin-header-theme" />
          <ShellAccountMenu placement="rail" />
        </div>
      </aside>
      {!shell.navigation.collapsed
        ? (
            <aside aria-label={translate('lumi.admin.navigation', undefined, 'Navigation')} className="lumi-shell-column lumi-shell-surface lumi-shell-panel lumi-shell-dual-context w-60 shrink-0 flex-col overflow-clip">
              {/* The head is the search or the workspace, as `app.search` picks. */}
              {contextPanel.claimed
                ? (
                    // A page that claims the column fills it, e.g. with its conversations.
                    <div ref={contextPanel.ref} data-slot="context-panel" data-testid="admin-context-panel" className="flex min-h-0 flex-1 flex-col" />
                  )
                : (
                    <>
                      <div className="flex h-14 shrink-0 items-center px-2">
                        {shell.app.search === 'sidebar' ? <ShellSidebarSearch minWidth={1200} /> : <ShellWorkspace />}
                      </div>
                      <nav data-testid="admin-sidebar" className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
                        {activeGroups.map(group => <ShellMenuGroup key={group.name} group={group} panel collapsible />)}
                        <ShellNoResults />
                      </nav>
                      {sidebarFooter ? <div data-slot="sidebar-footer" className="shrink-0 p-2">{sidebarFooter}</div> : null}
                    </>
                  )}
            </aside>
          )
        : null}
      <div className="lumi-shell-surface lumi-shell-workspace flex min-w-0 flex-1 flex-col overflow-clip">
        <header className="lumi-shell-header flex h-12 shrink-0 items-center gap-2 px-3">
          <ShellMobileButton layout="dual" />
          <span className="lumi-shell-dual-collapse-control">
            <ShellIconButton icon={shell.navigation.collapsed ? 'panel-left-open' : 'panel-left-close'} label={shell.navigation.collapsed ? translate('lumi.admin.expandSidebar', undefined, 'Expand sidebar') : translate('lumi.admin.collapseSidebar', undefined, 'Collapse sidebar')} onClick={shell.navigation.toggleCollapsed} testId="admin-sidebar-toggle" />
          </span>
          <div className="hidden min-w-0 items-center gap-1.5 text-label md:flex">
            <span className="truncate text-muted-foreground">{activeModuleLabel}</span>
            <span className="text-border" aria-hidden>/</span>
            <strong className="truncate font-medium text-foreground">{shell.active.item ? text(shell.active.item.label) : translate('lumi.admin.dashboard', undefined, 'Dashboard')}</strong>
          </div>
          <span data-testid="admin-breadcrumb" className="sr-only">{shell.active.breadcrumbs.map(item => item.label).join(' / ')}</span>
          {/* The query filters the context sidebar, so it leaves with it. */}
          {!shell.navigation.collapsed && shell.app.search === 'header' ? <ShellSearch className="lumi-shell-header-search lumi-shell-dual-search ml-4" shortcut minWidth={1200} /> : null}
          <div className="flex-1" />
          <div className="flex shrink-0 items-center gap-0.5">
            <ShellHeaderEnd theme={false} />
            <ShellAssistantDivider />
            <ShellAssistantToggle />
          </div>
        </header>
        {shell.auth.error ? <span role="alert" className="sr-only">{translate('lumi.admin.authError', undefined, 'Session unavailable')}</span> : null}
        <div className="lumi-shell-tab-strip flex h-10 shrink-0 items-center px-3"><ShellTabs /></div>
        <ShellMain>{children}</ShellMain>
      </div>
      <ShellAssistantPanel />
      <ShellMobileNavigation />
    </div>
  )
}
