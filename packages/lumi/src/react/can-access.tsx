import type { BaseComponentProps } from '@json-render/react'
import type { ReactNode } from 'react'
import type { CanAccessProps } from '../catalog/index.js'
import { useStateStore } from '@json-render/react'
import { useEffect } from 'react'
import { canAccessPropsSchema } from '../catalog/index.js'
import { useCan } from './providers.js'

export interface LumiCanAccessProps {
  resource: string
  action: string
  params?: Record<string, unknown>
  /** Shown when access is refused; nothing shows while it is checked. */
  fallback?: ReactNode
  children?: ReactNode
}

/** Renders `children` only when the access provider allows the action; shares useCan's cache. */
export function LumiCanAccess({ resource, action, params, fallback = null, children }: LumiCanAccessProps): ReactNode {
  const access = useCan({ resource, action, ...(params ? { params } : {}) })
  if (!access.data)
    return null
  return access.data.can ? children : fallback
}

/** The JSON `CanAccess` element: the same check, with an optional `resultPath` to bind other elements to. */
export function CanAccess({ props, children, slots }: BaseComponentProps<CanAccessProps>): ReactNode {
  const options = canAccessPropsSchema.parse(props)
  const { set } = useStateStore()
  const access = useCan({ resource: options.resource, action: options.action, ...(options.params ? { params: options.params } : {}) })
  const can = access.data?.can
  const reason = access.data?.reason
  const { resultPath } = options
  useEffect(() => {
    if (resultPath)
      set(resultPath, { can: can ?? false, loading: access.isPending, ...(reason ? { reason } : {}) })
  }, [resultPath, set, can, reason, access.isPending])
  if (can === undefined)
    return null
  return can ? children : slots?.fallback ?? null
}
