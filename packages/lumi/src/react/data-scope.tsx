import type { ReactElement, ReactNode } from 'react'
import { createContext, useContext } from 'react'

const DataProviderScope = createContext<string | undefined>(undefined)

/**
 * The data provider a part of the app uses when a hook, Query or data action
 * names none, such as every page of a menu group served by another backend.
 * An explicit `dataProviderName` still wins; scopes nest, the innermost wins.
 */
export function LumiDataProviderScope({ name, children }: { name?: string | undefined, children?: ReactNode }): ReactElement {
  const outer = useContext(DataProviderScope)
  return <DataProviderScope value={name ?? outer}>{children}</DataProviderScope>
}

/** `explicit`, else the enclosing scope's provider, else undefined (the default). */
export function useDataProviderName(explicit?: string): string | undefined {
  const scoped = useContext(DataProviderScope)
  return explicit ?? scoped
}

/** The options with the scope's provider filled in when they name none. */
export function useScopedTarget<T extends { dataProviderName?: string | undefined }>(options: T): T {
  const scoped = useContext(DataProviderScope)
  return options.dataProviderName !== undefined || scoped === undefined ? options : { ...options, dataProviderName: scoped }
}
