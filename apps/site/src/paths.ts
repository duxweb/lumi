import { withBase } from '../paths.mjs'

/** Links and public assets share the configured Astro deployment base. */
export function sitePath(path: string): string {
  return withBase(path, import.meta.env.BASE_URL)
}
