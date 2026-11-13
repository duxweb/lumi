import { createContext } from 'react'

/**
 * Reports whether a settings card holds unsettled work. A settings page joins
 * the reports into its own leave guard, so switching tabs asks first too.
 */
export type SettingsHold = (id: string, holding: boolean) => void

export const SettingsHoldContext = createContext<SettingsHold | undefined>(undefined)
