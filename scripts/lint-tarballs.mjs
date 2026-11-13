// Runs publint and/or attw against the tarballs packed once into .lumi-pack/,
// instead of letting each tool re-pack every package.
// Usage: node scripts/lint-tarballs.mjs [publint] [attw]
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'
import { readPackedTarballs, root } from './packed-tarballs.mjs'

const tools = process.argv.slice(2)
const commands = {
  publint: tarball => ['publint', ['run', tarball]],
  attw: tarball => ['attw', [tarball, '--profile', 'esm-only', '--exclude-entrypoints', './style.css']],
}
if (tools.length === 0 || tools.some(tool => !(tool in commands)))
  throw new Error(`Usage: lint-tarballs.mjs ${Object.keys(commands).join('|')} [...]`)

const tarballs = readPackedTarballs()
for (const tool of tools) {
  for (const [name, tarball] of tarballs) {
    const [binary, args] = commands[tool](tarball)
    process.stdout.write(`\n${tool} ${name}\n`)
    execFileSync(join(root, 'node_modules/.bin', binary), args, { cwd: root, stdio: 'inherit' })
  }
}
