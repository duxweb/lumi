#!/usr/bin/env node
import type { DocumentKind } from './index.js'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { checkDocument, describeComponent, DOCUMENT_KINDS, getCatalog, loadCatalogConfig } from './index.js'

const USAGE = `Usage:
  lumi-check <file.json|-> [--kind spec|manifest|theme|config] [--catalog catalog.mjs] [--json]
      Validate a document. Exit code 0 valid, 1 invalid, 2 file or catalog problem.
  lumi-check catalog [--kind components|actions] [--name <name>] [--catalog catalog.mjs]
      Print the Catalog's components and actions as JSON. With --name, an action comes with its params.
  lumi-check describe <Component> [--catalog catalog.mjs]
      Print one component's props schema, slots and events as JSON.
Default catalog: Lumi Admin preset (React schema). To validate a file named catalog or describe, write ./catalog.
`

const CATALOG_KINDS = ['components', 'actions'] as const
type CatalogKind = typeof CATALOG_KINDS[number]

async function stdin(): Promise<string> {
  let content = ''
  for await (const chunk of process.stdin) content += String(chunk)
  return content
}

/** The value after an option, which must be there and not be another option. */
function value(args: string[], index: number, message: string): string {
  const next = args[index]
  if (!next || next.startsWith('--'))
    throw new Error(message)
  return next
}

/** `lumi-check catalog`: the components and actions an author may use. */
async function catalogCommand(args: string[]): Promise<void> {
  let catalogPath: string | undefined
  let kind: CatalogKind | undefined
  let name: string | undefined
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '--kind') {
      const next = args[++index]
      if (!CATALOG_KINDS.includes(next as CatalogKind))
        throw new Error('--kind expects components or actions.')
      kind = next as CatalogKind
    }
    else if (arg === '--name') {
      name = value(args, ++index, '--name requires a component or action name.')
    }
    else if (arg === '--catalog') {
      catalogPath = value(args, ++index, '--catalog requires a module path.')
    }
    else if (arg !== '--json') {
      throw new Error(arg.startsWith('--') ? `Unknown option: ${arg}` : `Unexpected argument: ${arg}`)
    }
  }
  const { catalog } = await loadCatalogConfig(catalogPath)
  const result = getCatalog(catalog, { kind, name })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  // A name that matches nothing is an answer, but not a successful lookup.
  process.exitCode = name && !result.components.length && !result.actions.length ? 1 : 0
}

/** `lumi-check describe <Component>`: what one component accepts. */
async function describeCommand(args: string[]): Promise<void> {
  let catalogPath: string | undefined
  let type: string | undefined
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '--catalog')
      catalogPath = value(args, ++index, '--catalog requires a module path.')
    else if (arg === '--json')
      continue
    else if (arg.startsWith('--'))
      throw new Error(`Unknown option: ${arg}`)
    else if (type)
      throw new Error('Supply one component name.')
    else
      type = arg
  }
  if (!type)
    throw new Error('Supply a component name, such as: lumi-check describe Table')
  const { catalog } = await loadCatalogConfig(catalogPath)
  process.stdout.write(`${JSON.stringify(describeComponent(type, catalog), null, 2)}\n`)
}

/** `lumi-check <file>`: validates one document. */
async function checkCommand(args: string[]): Promise<void> {
  let file: string | undefined
  let catalogPath: string | undefined
  let json = false
  let kind: DocumentKind = 'spec'
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '--json') {
      json = true
    }
    else if (arg === '--kind') {
      const next = args[++index]
      if (!DOCUMENT_KINDS.includes(next as DocumentKind))
        throw new Error('--kind expects spec, manifest, theme or config.')
      kind = next as DocumentKind
    }
    else if (arg === '--catalog') {
      catalogPath = value(args, ++index, '--catalog requires a module path.')
    }
    else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`)
    }
    else if (file) {
      throw new Error('Supply one document file, or - for stdin.')
    }
    else {
      file = arg
    }
  }
  if (!file && process.stdin.isTTY) {
    throw new Error(
      'Supply a JSON file, or - for stdin. Use --help for usage.',
    )
  }
  const document = JSON.parse(
    file && file !== '-' ? await readFile(file, 'utf8') : await stdin(),
  )
  const config = await loadCatalogConfig(catalogPath)
  const result = checkDocument(document, config.catalog, {
    kind,
    directives: config.directives,
  })
  process.stdout.write(
    json
      ? `${JSON.stringify(result)}\n`
      : result.valid
        ? `Valid ${kind}.\n`
        : `${result.issues.map(issue => `${issue.severity} ${issue.path || '/'} ${issue.code}: ${issue.message}`).join('\n')}\n`,
  )
  process.exitCode = result.valid ? 0 : 1
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(USAGE)
    return
  }
  if (args[0] === 'catalog')
    return catalogCommand(args.slice(1))
  if (args[0] === 'describe')
    return describeCommand(args.slice(1))
  return checkCommand(args)
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exitCode = 2
})
