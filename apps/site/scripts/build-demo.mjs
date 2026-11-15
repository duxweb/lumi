import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { normalizeBase } from '../paths.mjs'

const result = spawnSync('pnpm', ['--dir', 'apps/admin', 'build:browser', '--outDir', '../site/public/demo', '--emptyOutDir'], {
  cwd: fileURLToPath(new URL('../../../', import.meta.url)),
  env: { ...process.env, LUMI_ADMIN_BASE: `${normalizeBase(process.env.LUMI_SITE_BASE)}demo/` },
  stdio: 'inherit',
})
if (result.error)
  throw result.error
process.exit(result.status ?? 1)
