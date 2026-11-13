import type { UserConfig } from 'tsdown'
import { defineConfig } from 'tsdown'

/**
 * Shared build config for framework-neutral TypeScript packages.
 * Output: ESM + .d.ts; dependencies are externalized by default (node_modules not bundled).
 */
export function defineLumiPackage(options: UserConfig = {}): UserConfig {
  return defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    external: (id: string) =>
      !id.startsWith('.')
      && !id.startsWith('/')
      && !id.startsWith('\0')
      && !id.startsWith('virtual:'),
    dts: true,
    clean: true,
    treeshake: true,
    ...options,
  })
}
