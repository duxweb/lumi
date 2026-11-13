import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index'

const roots: string[] = []
const requiredPeerDependencies = [
  '@hugeicons/core-free-icons',
  '@hugeicons/react',
  '@tanstack/react-query',
  'date-fns',
  'radix-ui',
  'react',
  'react-day-picker',
  'react-dom',
  'vaul',
]

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('create-lumi', () => {
  it('scaffolds the React shadcn template by default', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'lumi-create-'))
    roots.push(cwd)
    const root = await createApp({ cwd, name: 'react-app', install: false, git: false })
    const main = await readFile(join(root, 'src/main.tsx'), 'utf8')
    const packageSource = await readFile(join(root, 'package.json'), 'utf8')
    const packageJson = JSON.parse(packageSource) as { dependencies: Record<string, string>, devDependencies: Record<string, string> }
    const createPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

    expect(main).toContain('from \'@duxweb/lumi-ui\'')
    expect(main).toContain('@duxweb/lumi-ui/style.css')
    expect(packageJson.dependencies['@duxweb/lumi']).toBe(createPackage.version)
    expect(packageJson.dependencies['@duxweb/lumi-ui']).toBe(createPackage.version)
    expect(Object.values({ ...packageJson.dependencies, ...packageJson.devDependencies })).not.toContain('latest')
    expect(packageSource).not.toContain('lumi-ui-hero')
    expect(packageSource).not.toContain('lumi-ui-nuxt')
  })

  it.each(['pnpm', 'yarn'] as const)('declares every renderer peer for %s consumers', async (pm) => {
    const cwd = await mkdtemp(join(tmpdir(), `lumi-create-${pm}-`))
    roots.push(cwd)
    const root = await createApp({ cwd, name: `${pm}-app`, pm, install: false, git: false })
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string>, devDependencies: Record<string, string> }

    for (const dependency of requiredPeerDependencies)
      expect(packageJson.dependencies).toHaveProperty(dependency)
    expect(Object.values({ ...packageJson.dependencies, ...packageJson.devDependencies })).not.toContain('latest')
  })

  it('writes the Lumi skill over the shared catalog, unless --no-ai', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'lumi-create-ai-'))
    roots.push(cwd)
    const root = await createApp({ cwd, name: 'ai-app', install: false, git: false })
    const skill = await readFile(join(root, '.claude/skills/lumi/SKILL.md'), 'utf8')
    const createPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

    expect(skill).toContain('name: lumi')
    expect(await readFile(join(root, '.agents/skills/lumi/SKILL.md'), 'utf8')).toBe(skill)
    // The skill's lookup commands run the version of lumi-check this scaffold was published with.
    expect(skill).toContain(`npx -y @duxweb/lumi-check@${createPackage.version} describe`)
    await expect(readFile(join(root, '.mcp.json'), 'utf8')).rejects.toThrow()
    expect(await readFile(join(root, 'src/catalog.mjs'), 'utf8')).toContain('export const catalog')

    const plain = await createApp({ cwd, name: 'plain-app', install: false, git: false, ai: false })
    await expect(readFile(join(plain, '.claude/skills/lumi/SKILL.md'), 'utf8')).rejects.toThrow()
  })

  it('rejects retired templates', async () => {
    await expect(createApp({ name: 'invalid', template: 'default' as never, install: false, git: false })).rejects.toThrow('Unknown template')
  })
})
