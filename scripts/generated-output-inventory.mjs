import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

async function entries(path) {
  return readdir(path, { withFileTypes: true }).catch(() => [])
}

async function assertEntries(root, path, expected, optional = []) {
  const actual = (await entries(path)).map(entry => `${entry.isDirectory() ? 'd' : 'f'}:${entry.name}`).sort()
  const required = [...expected].sort()
  const allowedOptional = new Set(optional)
  const missing = required.filter(entry => !actual.includes(entry))
  const extra = actual.filter(entry => !required.includes(entry) && !allowedOptional.has(entry))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(`Generated output inventory mismatch in ${relative(root, path)}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`)
  }
}

export async function verifyGeneratedOutputInventory(root) {
  const generatedRoot = join(root, 'apps/site/src/docs/generated')
  const publicRoot = join(root, 'apps/site/public')
  await assertEntries(root, generatedRoot, ['f:api-reference.json', 'f:navigation.mjs'])
  await assertEntries(root, publicRoot, [
    'd:component-schemas',
    // Static images of the homepage, kept by hand.
    'd:home',
    'f:api-reference.json',
    'f:catalog.json',
    'f:llms-full.txt',
    'f:llms.txt',
    'f:locale-reference.json',
    'f:theme-reference.json',
    // The admin demo is a build output, present only after `build:demo`.
  ], ['d:demo'])
  // One file per GALLERY_PAGES entry: the browsable groups the component
  // gallery and the docs guide share.
  await assertEntries(root, join(publicRoot, 'component-schemas'), [
    'f:agent.json',
    'f:choice.json',
    'f:composition.json',
    'f:data.json',
    'f:feedback.json',
    'f:standard.json',
    'f:surfaces.json',
    'f:text.json',
  ])
}
