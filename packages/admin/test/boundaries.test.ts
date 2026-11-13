import type { Dirent } from 'node:fs'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')
const scanned = /\.(?:css|ts|tsx)$/u
const skippedDirs = new Set(['dist', 'node_modules', 'generated', '.astro'])

function collect(dir: string, files: string[]): void {
  let entries: Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name))
        collect(path, files)
    }
    else if (entry.isFile() && scanned.test(entry.name)) {
      files.push(path)
    }
  }
}

/** Source roots that consume Lumi UI only through its public API. */
function consumerSources(): string[] {
  const roots = [resolve(root, 'packages/admin/src')]
  for (const group of ['apps', 'examples']) {
    for (const entry of readdirSync(resolve(root, group), { withFileTypes: true })) {
      if (entry.isDirectory())
        roots.push(resolve(root, group, entry.name, 'src'))
    }
  }
  const files: string[] = []
  for (const dir of roots)
    collect(dir, files)
  return files
}

describe('public theme boundaries', () => {
  it('keeps UI-private --lumi-ui-* tokens out of Admin, app and example sources', () => {
    const files = consumerSources()
    expect(files.length).toBeGreaterThan(0)
    const violations = files
      .filter(file => readFileSync(file, 'utf8').includes('--lumi-ui-'))
      .map(file => relative(root, file))
    expect(violations).toEqual([])
  })
})
