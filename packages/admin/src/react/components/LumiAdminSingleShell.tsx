import type { PropsWithChildren, ReactElement } from 'react'
import { useTranslate } from '@duxweb/lumi'
import { useShell, useShellSidebarFooter } from './ShellContext.js'
import {
  ShellAccountMenu,
  ShellAssistantPanel,
  ShellAssistantToggle,
  ShellHeaderEnd,
  ShellMain,
  ShellMenuGroup,
  ShellMobileButton,
  ShellMobileNavigation,
  ShellNoResults,
  ShellSearch,
  ShellSidebarSearch,
  ShellTabs,
  ShellWorkspace,
  useFilteredGroups,
} from './ShellParts.js'

export interface LumiAdminSingleShellProps extends PropsWithChildren {}

/** The shell with one sidebar holding the whole menu. */
export function LumiAdminSingleShell({ children }: LumiAdminSingleShellProps): ReactElement {
  const shell = useShell()
  const translate = useTranslate()
  const sidebarFooter = useShellSidebarFooter()
  const groups = useFilteredGroups(shell.groups)
  const breadcrumbs = shell.active.breadcrumbs

  return (
    // Shell wrappers clip instead of hiding overflow: a hidden box is still a scroll container, so
    // scrollIntoView and fragment navigation would scroll it and offset the whole shell. Only main scrolls.
    <div data-lumi-shell data-layout="single" className="lumi-page lumi-shell-frame fixed inset-0 flex overflow-clip text-foreground">
      <aside aria-label={translate('lumi.admin.navigation', undefined, 'Navigation')} className="lumi-shell-column lumi-shell-surface lumi-shell-panel lumi-shell-single-sidebar w-60 shrink-0 flex-col overflow-clip">
        {/* Without a rail the workspace always heads the sidebar; the search, when
            it lives here, sits right under it. */}
        <div className="flex h-14 shrink-0 items-center px-2"><ShellWorkspace /></div>
        {shell.app.search === 'sidebar' ? <div className="shrink-0 px-2 pb-2"><ShellSidebarSearch minWidth={768} /></div> : null}
        <nav data-testid="admin-sidebar" className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
          {groups.map(group => <ShellMenuGroup key={group.name} group={group} panel />)}
          <ShellNoResults />
        </nav>
        {sidebarFooter ? <div data-slot="sidebar-footer" className="shrink-0 p-2">{sidebarFooter}</div> : null}
        {shell.auth.error ? <p role="alert" className="px-3 pb-2 text-caption text-destructive">{translate('lumi.admin.authError', undefined, 'Session unavailable')}</p> : null}
      </aside>
      <div className="lumi-shell-surface lumi-shell-workspace flex min-w-0 flex-1 flex-col overflow-clip">
        <header className="lumi-shell-header flex h-12 shrink-0 items-center gap-3 px-3">
          <ShellMobileButton layout="single" />
          <div className="flex min-w-0 items-center gap-1.5 text-label">
            {breadcrumbs.slice(-2).map((breadcrumb, index, list) => (
              <span key={breadcrumb.key} className={index === list.length - 1 ? 'flex min-w-0 items-center gap-1.5' : 'hidden min-w-0 items-center gap-1.5 sm:flex'}>
                {index > 0 ? <span className="text-border" aria-hidden>/</span> : null}
                <span className={index === list.length - 1 ? 'truncate font-medium text-foreground' : 'truncate text-muted-foreground'}>{breadcrumb.label}</span>
              </span>
            ))}
          </div>
          {shell.app.search === 'header' ? <ShellSearch className="lumi-shell-header-search lumi-shell-single-search ml-4" shortcut minWidth={768} /> : null}
          <div className="flex-1" />
          {/* One account entry: theme and sign-out sit inside it. Host chrome
              — the design's notifications bell — leads it. */}
          <div className="flex shrink-0 items-center gap-1">
            <ShellHeaderEnd />
            <ShellAssistantToggle />
            <ShellAccountMenu />
          </div>
        </header>
        <div className="lumi-shell-tab-strip flex h-10 shrink-0 items-center px-3"><ShellTabs /></div>
        <ShellMain>{children}</ShellMain>
      </div>
      <ShellAssistantPanel />
      <ShellMobileNavigation />
    </div>
  )
}
