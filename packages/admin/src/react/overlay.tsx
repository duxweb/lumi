import type { ReactElement } from 'react'
import { LumiOverlayHost } from '@duxweb/lumi'
import { LumiDialog, LumiDrawer } from '@duxweb/lumi-ui'

export function AdminOverlayHost(): ReactElement {
  return (
    <LumiOverlayHost
      render={(entry, close, children) =>
        entry.type === 'drawer'
          ? (
              <LumiDrawer
                open
                title={entry.title}
                description={entry.message}
                side={entry.placement}
                onOpenChange={(open) => {
                  if (!open)
                    void close('dismiss')
                }}
              >
                {children}
              </LumiDrawer>
            )
          : (
              <LumiDialog
                open
                title={entry.title}
                description={entry.message}
                tone={entry.tone}
                icon={entry.icon}
                confirmText={entry.confirmText}
                cancelText={entry.cancelText}
                onOpenChange={(open) => {
                  if (!open)
                    void close('dismiss')
                }}
                onConfirm={() => {
                  void close('confirm', true)
                }}
                onCancel={() => {
                  void close('cancel', false)
                }}
              >
                {children}
              </LumiDialog>
            )}
    />
  )
}
