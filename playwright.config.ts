import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

interface WebServer { command: string, url: string, timeout?: number }
interface E2eProject { name: string, spec: RegExp, port: number, servers: WebServer[] }

// Opt-in reuse only: a stale preview silently serving old code is worse than a
// port-in-use failure. Set LUMI_E2E_REUSE=1 to attach to servers you started.
const reuseExistingServer = process.env.LUMI_E2E_REUSE === '1'
const preview = (port: number) => `http://127.0.0.1:${port}`
const mock: WebServer = { command: 'node apps/admin/mock/server.ts', url: 'http://127.0.0.1:3002/health' }

const e2eProjects: E2eProject[] = [
  { name: 'react-demo', spec: /react-demo\.spec\.ts/, port: 4177, servers: [{ command: 'pnpm --dir examples/react-demo build && pnpm --dir examples/react-demo exec vite preview --host 127.0.0.1 --port 4177', url: preview(4177) }] },
  { name: 'foundation-admin', spec: /foundation-admin\.spec\.ts/, port: 4178, servers: [{ command: 'pnpm --dir examples/foundation-admin build && pnpm --dir examples/foundation-admin exec vite preview --host 127.0.0.1 --port 4178', url: preview(4178) }] },
  // The official site: homepage, docs, Playground and the in-browser admin demo.
  { name: 'site', spec: /site\.spec\.ts/, port: 4179, servers: [{ command: 'pnpm -F @duxweb/lumi-site build && pnpm -F @duxweb/lumi-site preview', url: preview(4179), timeout: 600_000 }] },
  // The prebuilt base served by a plain static server: no bundler touches the app.
  { name: 'base-admin', spec: /base-admin\.spec\.ts/, port: 4182, servers: [mock, { command: 'pnpm -F @duxweb/lumi-admin build:base && PORT=4182 node examples/base-admin/serve.mjs', url: preview(4182) }] },
  { name: 'react-admin', spec: /(?:^|\/)react-admin\.spec\.ts$/, port: 4181, servers: [mock, { command: 'pnpm --dir apps/admin exec vite build && pnpm --dir apps/admin exec vite preview --host 127.0.0.1 --port 4181', url: preview(4181) }] },
]

/** Projects named through `--project` (any form), or every project when none is given. */
function selectedProjects(argv: readonly string[]): E2eProject[] {
  const names = new Set<string>()
  argv.forEach((arg, index) => {
    if (arg === '--project' && argv[index + 1])
      names.add(argv[index + 1]!)
    else if (arg.startsWith('--project='))
      names.add(arg.slice('--project='.length))
  })
  return names.size === 0 ? e2eProjects : e2eProjects.filter(project => names.has(project.name))
}

/**
 * Only the selected projects' servers are started. Apps resolve workspace
 * packages from source (`lumi:source`) and need only the compiled UI/Admin
 * CSS, so one CSS-only build runs ahead of the first app server instead of a
 * full package build per server.
 */
function webServers(projects: readonly E2eProject[]) {
  const unique = [...new Map(projects.flatMap(project => project.servers).map(server => [server.url, server])).values()]
  let stylesBuilt = false
  return unique.map((server) => {
    const command = server === mock || stylesBuilt ? server.command : `pnpm -F @duxweb/lumi-ui -F @duxweb/lumi-admin build:css && ${server.command}`
    stylesBuilt ||= server !== mock
    return { timeout: 120_000, ...server, command, reuseExistingServer }
  })
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  // Font rasterisation differs per OS; baselines are kept per platform. Linux
  // baselines come from .github/workflows/visual-baselines.yml.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{platform}{ext}',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce' },
  projects: e2eProjects.map(project => ({ name: project.name, testMatch: project.spec, use: { baseURL: preview(project.port) } })),
  webServer: webServers(selectedProjects(process.argv)),
})
