import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const conditions = ['lumi:source', 'module', 'node', 'import', 'default']
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  // Workspace packages resolve to their TS source through the "lumi:source" export
  // condition, so tests run against source without a build step. The node test
  // environment resolves through Vite's ssr environment, hence ssr.resolve; the
  // client resolve covers DOM-environment tests.
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    environment: 'node',
    setupFiles: [r('./test/setup.ts')],
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx', 'apps/*/test/**/*.test.ts', 'examples/*/test/**/*.test.ts'],
  },
})
