#!/usr/bin/env tsx
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { adminBaseConfigSchema } from '../packages/admin/src/base-config.js'
import { checkDocument } from '../packages/check/src/index.js'
import { stripJsonComments } from './jsonc.mjs'

const root = resolve(import.meta.dirname, '..')
async function walk(dir: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map(entry =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : [join(dir, entry.name)],
      ),
    )
  ).flat()
}
const GUIDE_COMPONENTS = ['OrderSummary', 'StarScore']
const GUIDE_ACTIONS = ['copyText']
let checked = 0
for (const file of await walk(join(root, 'apps/site/src/content/docs'))) {
  const source = await readFile(file, 'utf8')
  // `jsonc` examples carry comments for the reader; the page file is the same JSON without them.
  for (const match of source.matchAll(/```(jsonc?)\n([\s\S]*?)\n```/gu)) {
    const value = JSON.parse(match[1] === 'jsonc' ? stripJsonComments(match[2]!) : match[2]!) as Record<string, unknown>
    // A translation file: a flat map of message keys to text.
    if (Object.values(value).every(entry => typeof entry === 'string'))
      continue
    // A prebuilt base's config.json.
    if ('panels' in value) {
      const config = adminBaseConfigSchema.safeParse(value)
      if (!config.success)
        throw new Error(`${relative(root, file)}: ${config.error.message}`)
      checked++
      continue
    }
    // A single element is checked inside the smallest page that holds it.
    // It is a piece of a larger page, so the children it names live elsewhere.
    const fragment = 'type' in value && 'props' in value
    const document = fragment
      ? { root: 'example', elements: { example: { children: [], ...value } } }
      : value
    const kind
      = 'root' in document
        ? 'spec'
        : 'routes' in document
          ? 'manifest'
          : 'mode' in document
            ? 'theme'
            : undefined
    if (!kind)
      throw new Error(`Unclassified JSON example: ${relative(root, file)}`)
    const result = checkDocument(document, undefined, { kind })
    // Components and actions a guide registers itself before using them.
    const issues = result.issues.filter(issue => !(issue.code === 'unknown_component' && GUIDE_COMPONENTS.some(name => issue.message.endsWith(`: ${name}`))) && !(issue.code === 'unknown_action' && GUIDE_ACTIONS.some(name => issue.message.endsWith(`: ${name}`))) && !(fragment && issue.code === 'missing_child'))
    if (issues.length) {
      throw new Error(
        `${relative(root, file)}: ${JSON.stringify(issues)}`,
      )
    }
    checked++
  }
}
if (!checked)
  throw new Error('No JSON examples checked')
console.log(`Validated ${checked} native JSON examples`)
