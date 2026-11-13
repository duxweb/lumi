import type { RouterProvider } from '@duxweb/lumi'
import type { ActionHandler } from '@json-render/core'
import type { AdminDrawerController } from './routedDrawer.js'
import { useLumi } from '@duxweb/lumi'
import { useMemo } from 'react'
import { adminActionDefinitions } from '../catalog/index.js'
import { useAdminDrawer } from './routedDrawer.js'

/** The handlers of the Admin's own actions: `navigate`, `openDrawer` and `closeDrawer`. */
export function createAdminHandlers(
  router: RouterProvider | undefined,
  drawer: AdminDrawerController,
): Record<string, ActionHandler> {
  return {
    navigate: (input) => {
      const params = adminActionDefinitions.navigate.params.parse(input)
      if (!router)
        throw new Error('[lumi-admin] Router is not configured.')
      router.go(params)
    },
    openDrawer: (input) => {
      const { name, src, ...options } = adminActionDefinitions.openDrawer.params.parse(input)
      drawer.open((name ?? src)!, options)
    },
    closeDrawer: (input) => {
      adminActionDefinitions.closeDrawer.params.parse(input)
      drawer.close()
    },
  }
}
/** The Admin handlers joined with `extra`; a name a built-in handler already has throws. */
export function useAdminHandlers(
  extra?: Record<string, ActionHandler>,
): Record<string, ActionHandler> {
  const { routerProvider } = useLumi()
  const drawer = useAdminDrawer()
  return useMemo(() => {
    const handlers = createAdminHandlers(routerProvider, drawer)
    for (const name of Object.keys(extra ?? {})) {
      if (name in handlers)
        throw new Error(`[lumi-admin] Duplicate handler: ${name}`)
    }
    return { ...handlers, ...extra }
  }, [routerProvider, drawer, extra])
}
