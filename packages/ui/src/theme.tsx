import type { PropsWithChildren, ReactElement } from 'react'
import { useEffect, useState } from 'react'

export type LumiColorMode = 'light' | 'dark' | 'system'

export interface LumiThemeProviderProps extends PropsWithChildren {
  mode?: LumiColorMode
  className?: string
}

function systemColorMode(): Exclude<LumiColorMode, 'system'> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Scopes a colour mode (`light`, `dark` or `system`) to its children. */
export function LumiThemeProvider({ mode = 'system', className, children }: LumiThemeProviderProps): ReactElement {
  const [systemMode, setSystemMode] = useState(systemColorMode)
  useEffect(() => {
    if (mode !== 'system')
      return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (): void => setSystemMode(media.matches ? 'dark' : 'light')
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [mode])
  return <div className={className} data-theme={mode === 'system' ? systemMode : mode}>{children}</div>
}
