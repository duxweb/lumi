import type { PropsWithChildren, ReactElement } from 'react'
import { LumiAdminDualShell } from './LumiAdminDualShell.js'
import { LumiAdminSingleShell } from './LumiAdminSingleShell.js'
import { useShell } from './ShellContext.js'

export interface LumiAdminShellProps extends PropsWithChildren {}

/** The Admin shell in the layout the manifest names: one sidebar, or a module rail beside it. */
export function LumiAdminShell({ children }: LumiAdminShellProps): ReactElement {
  const shell = useShell()
  return shell.app.layout === 'single'
    ? <LumiAdminSingleShell>{children}</LumiAdminSingleShell>
    : <LumiAdminDualShell>{children}</LumiAdminDualShell>
}
