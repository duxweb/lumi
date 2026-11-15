#!/usr/bin/env tsx
import type { ActionExample } from '../apps/site/src/docs/reference/action-docs.js'
import { mkdir as fsMkdir, rm as fsRm, writeFile as fsWriteFile, readdir, readFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { format } from 'prettier'
import ts from 'typescript'
import { focusComponentDemo } from '../apps/site/src/docs/focus.js'
import { ACTION_DOCS, ACTION_PARAM_OVERRIDES, ACTION_PARAMS } from '../apps/site/src/docs/reference/action-docs.js'
import { actionParamSchemas, docsCatalog, typeLabel } from '../apps/site/src/docs/reference/catalog.js'
import { componentLead } from '../apps/site/src/docs/reference/component-docs.js'
import { FAMILIES, familyOf, OTHER_FAMILY } from '../apps/site/src/docs/reference/families.js'
import { PLUMBING_PROPS, propDoc } from '../apps/site/src/docs/reference/prop-docs.js'
import { GALLERY_PAGES } from '../examples/schema-gallery/src/index.js'
import { apiItem, code, fence, firstSentence, frontmatter, leadSentence, page, prose, table } from './docs-markdown.js'
import { verifyGeneratedOutputInventory } from './generated-output-inventory.mjs'

const root = resolve(import.meta.dirname, '..')
const contentRoot = join(root, 'apps/site/src/content/docs')
const generatedRoot = join(root, 'apps/site/src/docs/generated')
const publicRoot = join(root, 'apps/site/public')
const packagesRoot = join(root, 'packages')
const LOWER_UPPER_RE = /([a-z\d])([A-Z])/gu
const UPPER_WORD_RE = /([A-Z]+)([A-Z][a-z])/gu
const LEADING_DOT_SLASH_RE = /^\.\//u
const MAX_TYPE_TEXT_LENGTH = 320
const apiOnly = process.argv.includes('--api-only')
const checkMode = process.argv.includes('--check')
const clearedDirectories = new Set<string>()
const expectedWrites = new Set<string>()

const PUBLIC_PACKAGE_NAMES = ['@duxweb/lumi', '@duxweb/lumi-ui', '@duxweb/lumi-admin', '@duxweb/lumi-check', '@duxweb/create-lumi'] as const

const FORBIDDEN_PUBLIC_SYMBOLS = new Set([
  'ActionRequestProviderOptions',
  'CustomMethod',
  'ResourceDefinition',
  'ResourceRegistry',
  'ResourceSchema',
  'createPro',
  'createVuePro',
  'defineLumiVueProExtension',
  'defineResource',
  'getActionRequest',
  'getActionRequestProviderOptions',
  'useResource',
  'validateResource',
])

async function mkdir(path: string, options: { recursive: true }): Promise<string | undefined> {
  if (checkMode)
    return undefined
  return fsMkdir(path, options)
}

async function rm(path: string, options: { recursive: true, force: true }): Promise<void> {
  if (checkMode) {
    clearedDirectories.add(resolve(path))
    return
  }
  await fsRm(path, options)
}

async function writeFile(path: string, contents: string): Promise<void> {
  const outputPath = resolve(path)
  expectedWrites.add(outputPath)
  if (!checkMode) {
    await fsWriteFile(outputPath, contents)
    return
  }
  const current = await readFile(outputPath, 'utf8').catch(() => '')
  if (current !== contents)
    throw new Error(`Generated docs output is stale: ${relative(root, outputPath)}`)
}

async function listFiles(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  const files = await Promise.all(entries.map(async (entry) => {
    const child = join(path, entry.name)
    return entry.isDirectory() ? listFiles(child) : [resolve(child)]
  }))
  return files.flat()
}

async function verifyClearedDirectories(): Promise<void> {
  if (!checkMode)
    return
  for (const directory of clearedDirectories) {
    const stale = (await listFiles(directory)).filter(path => !expectedWrites.has(path))
    if (stale.length > 0)
      throw new Error(`Stale generated docs output exists under ${relative(root, directory)}: ${stale.map(path => relative(root, path)).join(', ')}`)
  }
}

const categoryLabels: Record<string, string> = {
  layout: '布局组件',
  form: '表单结构',
  input: '输入控件',
  action: '操作组件',
  data: '数据展示',
  overlay: '弹层与反馈',
  navigation: '导航组件',
  advanced: '高级组件',
}

interface ApiMember {
  name: string
  type: string
  required: boolean
  description: string
}

interface ApiParameter extends ApiMember {
  fields: ApiMember[]
}

interface ApiItem {
  name: string
  importPath: string
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable'
  description: string
  type: string
  signatures: string[]
  parameters: ApiParameter[]
  returns: string[]
  returnFields: ApiMember[]
  members: ApiMember[]
}

interface PackageApi {
  name: string
  slug: string
  path: string
  description: string
  entrypoints: string[]
  items: ApiItem[]
}

interface PackageSourceEntry {
  importPath: string
  source: string
}

function documentation(symbol: ts.Symbol, checker: ts.TypeChecker): string {
  return ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim()
}

const catalogDescriptions = new Map(docsCatalog.components.map(component => [component.type, component.description]))

/**
 * A `Lumi<Type>` export is the React component of the Catalog's `<Type>`
 * element; without a doc comment of its own it is described by the Catalog,
 * the one place that element is defined.
 */
function componentDescription(name: string): string {
  const type = name.startsWith('Lumi') ? name.slice(4) : ''
  const description = catalogDescriptions.get(type)
  return description ? `The React component of the JSON \`${type}\` element. ${description}` : ''
}

function declarationFor(symbol: ts.Symbol): ts.Declaration | undefined {
  return symbol.valueDeclaration ?? symbol.declarations?.[0]
}

function typeText(checker: ts.TypeChecker, type: ts.Type, declaration?: ts.Node): string {
  return checker.typeToString(type, declaration, ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope)
}

function nullableObjectMember(type: ts.Type): ts.Type | undefined {
  if (!type.isUnion())
    return type
  const members = type.types.filter(member => !(member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)))
  if (members.length === 1)
    return members[0]
  return members.length === type.types.length ? type : undefined
}

function isStructuredObjectType(checker: ts.TypeChecker, type: ts.Type): boolean {
  const value = nullableObjectMember(type)
  if (!value || value.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never | ts.TypeFlags.TypeParameter))
    return false

  const properties = checker.getPropertiesOfType(value)
  if (properties.length === 0)
    return false
  const hasLocalProperty = properties.some(property => property.declarations?.some(declaration => declaration.getSourceFile().fileName.startsWith(packagesRoot)))
  if (value.isUnion())
    return hasLocalProperty && value.types.every(member => member.isIntersection())
  if (hasLocalProperty)
    return true
  if (checker.getIndexTypeOfType(value, ts.IndexKind.Number) || checker.getIndexTypeOfType(value, ts.IndexKind.String))
    return false

  const symbol = value.aliasSymbol ?? value.getSymbol()
  if (!symbol)
    return Boolean(value.flags & ts.TypeFlags.Object)
  if (symbol.flags & ts.SymbolFlags.Class)
    return false
  if (['Array', 'ReadonlyArray', 'Date', 'File', 'FileList', 'Promise', 'String', 'Number', 'Boolean'].includes(symbol.name))
    return false
  const declarations = symbol.declarations ?? []
  return hasLocalProperty || declarations.some(declaration => declaration.getSourceFile().fileName.startsWith(packagesRoot))
}

function membersOf(checker: ts.TypeChecker, type: ts.Type, fallback: ts.Node): ApiMember[] {
  const value = nullableObjectMember(type)
  if (!value)
    return []
  if (!isStructuredObjectType(checker, value))
    return []
  return checker.getPropertiesOfType(value).flatMap((member): ApiMember[] => {
    const declaration = declarationFor(member) ?? fallback
    const memberType = typeText(checker, checker.getTypeOfSymbolAtLocation(member, declaration), declaration)
    if (memberType.length > MAX_TYPE_TEXT_LENGTH)
      return []
    return {
      name: member.name,
      type: memberType,
      required: (member.flags & ts.SymbolFlags.Optional) === 0,
      description: documentation(member, checker),
    } satisfies ApiMember
  }).sort((left, right) => left.name.localeCompare(right.name))
}

function apiKind(symbol: ts.Symbol, type: ts.Type): ApiItem['kind'] {
  if (symbol.flags & ts.SymbolFlags.Class)
    return 'class'
  if (symbol.flags & ts.SymbolFlags.Interface)
    return 'interface'
  if (symbol.flags & ts.SymbolFlags.TypeAlias)
    return 'type'
  if (type.getCallSignatures().length > 0)
    return 'function'
  return 'variable'
}

function packageSlug(name: string): string {
  if (name === '@duxweb/lumi')
    return 'lumi'
  if (name === '@duxweb/create-lumi')
    return 'create'
  return name.replace('@duxweb/lumi-', '')
}

async function collectPackageApis(): Promise<PackageApi[]> {
  const directories = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && ts.sys.fileExists(join(packagesRoot, entry.name, 'package.json')))
    .map(entry => join(packagesRoot, entry.name))
  const packageEntries = await Promise.all(directories.map(async (directory) => {
    const packageJson = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      name: string
      description?: string
      exports?: Record<string, string | Record<string, string>>
    }
    const sourceEntries = new Map<string, string>()
    for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
      if (typeof target === 'string')
        continue
      const relativeSource = target['lumi:source']
        ?? (target.types?.startsWith('./src/') ? target.types : undefined)
        ?? (target.import?.startsWith('./src/') ? target.import : undefined)
      if (!relativeSource)
        continue
      const source = join(directory, relativeSource.replace(LEADING_DOT_SLASH_RE, ''))
      if (!ts.sys.fileExists(source))
        continue
      const importPath = subpath === '.' ? packageJson.name : `${packageJson.name}${subpath.slice(1)}`
      sourceEntries.set(importPath, source)
    }
    if (!sourceEntries.has(packageJson.name)) {
      const sourceEntry = join(directory, 'src', 'index.ts')
      const declarationEntry = join(directory, 'src', 'index.d.ts')
      const source = ts.sys.fileExists(sourceEntry) ? sourceEntry : ts.sys.fileExists(declarationEntry) ? declarationEntry : undefined
      if (source)
        sourceEntries.set(packageJson.name, source)
    }
    const entries = Array.from(sourceEntries, ([importPath, source]): PackageSourceEntry => ({ importPath, source }))
    return entries.length > 0 ? { directory, entries, packageJson } : undefined
  }))
  const entries = packageEntries.filter(entry => entry !== undefined && (PUBLIC_PACKAGE_NAMES as readonly string[]).includes(entry.packageJson.name))
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile)
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const program = ts.createProgram(entries.flatMap(entry => entry.entries.map(source => source.source)), {
    ...parsed.options,
    allowJs: true,
    declaration: false,
    jsx: ts.JsxEmit.Preserve,
    noEmit: true,
  })
  const checker = program.getTypeChecker()

  return entries.map(({ directory, entries: sourceEntries, packageJson }): PackageApi => {
    const items = sourceEntries.flatMap(({ importPath, source: sourcePath }): ApiItem[] => {
      const source = program.getSourceFile(sourcePath)
      const moduleSymbol = source ? checker.getSymbolAtLocation(source) : undefined
      return (moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []).flatMap((exported): ApiItem[] => {
        if (exported.name === 'default')
          return []
        const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
        const declaration = declarationFor(symbol) ?? source
        if (!declaration)
          return []
        const type = checker.getTypeOfSymbolAtLocation(exported, declaration)
        const kind = apiKind(symbol, type)
        const calls = type.getCallSignatures()
        const constructors = kind === 'class' ? type.getConstructSignatures() : []
        const signatures = calls.length > 0 ? calls : constructors
        const parameters = signatures[0]?.getParameters().map((parameter): ApiParameter => {
          const parameterDeclaration = declarationFor(parameter) ?? declaration
          const parameterType = checker.getTypeOfSymbolAtLocation(parameter, parameterDeclaration)
          return {
            name: parameter.name,
            type: typeText(checker, parameterType, parameterDeclaration),
            required: (parameter.flags & ts.SymbolFlags.Optional) === 0
              && !(ts.isParameter(parameterDeclaration) && (parameterDeclaration.questionToken || parameterDeclaration.initializer)),
            description: documentation(parameter, checker),
            fields: membersOf(checker, parameterType, parameterDeclaration),
          }
        }) ?? []
        const returnTypes = signatures.map(signature => checker.getReturnTypeOfSignature(signature))
        const documentedReturnType = returnTypes[0]
          ? checker.getPromisedTypeOfPromise(returnTypes[0]) ?? returnTypes[0]
          : undefined
        const declaredType = ts.isTypeAliasDeclaration(declaration)
          ? checker.getTypeFromTypeNode(declaration.type)
          : (kind === 'interface' || kind === 'class') && (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.Class))
              ? checker.getDeclaredTypeOfSymbol(symbol)
              : type
        const members = kind === 'interface' || kind === 'class' || (kind === 'type' && checker.getPropertiesOfType(declaredType).length > 0)
          ? membersOf(checker, declaredType, declaration)
          : []
        const returns = [...new Set(returnTypes.map(returnType => typeText(checker, returnType, declaration)))]
        return [{
          name: exported.name,
          importPath,
          kind,
          description: documentation(symbol, checker) || documentation(exported, checker) || (kind === 'function' ? componentDescription(exported.name) : ''),
          type: typeText(checker, kind === 'interface' || kind === 'type' ? declaredType : type, declaration),
          signatures: signatures.map(signature => `${calls.length > 0 ? exported.name : `new ${exported.name}`}${checker.signatureToString(signature, declaration, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.WriteTypeArgumentsOfSignature)}`),
          parameters,
          returns,
          returnFields: documentedReturnType ? membersOf(checker, documentedReturnType, declaration) : [],
          members,
        }]
      })
    }).sort((left, right) => left.name.localeCompare(right.name) || left.importPath.localeCompare(right.importPath))
    return {
      name: packageJson.name,
      slug: packageSlug(packageJson.name),
      path: `packages/${basename(directory)}`,
      description: packageJson.description ?? '',
      entrypoints: sourceEntries.map(entry => entry.importPath),
      items,
    }
  }).sort((left, right) => left.name.localeCompare(right.name))
}

function assertApiCoverage(packageApis: PackageApi[]): void {
  const byName = new Map(packageApis.map(pkg => [pkg.name, pkg]))
  const missingPackages = PUBLIC_PACKAGE_NAMES.filter(name => !byName.get(name)?.items.length)
  if (missingPackages.length > 0)
    throw new Error(`API documentation has no public symbols for: ${missingPackages.join(', ')}`)

  const expectedPackages = new Set<string>(PUBLIC_PACKAGE_NAMES)
  const unexpectedPackages = packageApis.filter(pkg => !expectedPackages.has(pkg.name)).map(pkg => pkg.name)
  if (unexpectedPackages.length > 0)
    throw new Error(`API documentation found packages outside the current architecture: ${unexpectedPackages.join(', ')}`)

  const forbiddenSymbols = packageApis.flatMap(pkg => pkg.items
    .filter(item => FORBIDDEN_PUBLIC_SYMBOLS.has(item.name))
    .map(item => `${pkg.name}:${item.name}`))
  if (forbiddenSymbols.length > 0)
    throw new Error(`API documentation found retired public symbols: ${forbiddenSymbols.join(', ')}`)

  // Functions and classes are what a reader calls; each says what it does.
  const undescribed = packageApis.flatMap(pkg => pkg.items
    .filter(item => (item.kind === 'function' || item.kind === 'class') && !item.description)
    .map(item => `${item.importPath}:${item.name}`))
  if (undescribed.length > 0)
    throw new Error(`Exported functions and classes need a doc comment in their source: ${[...new Set(undescribed)].join(', ')}`)

  for (const pkg of packageApis) {
    const emptyEntrypoints = pkg.entrypoints.filter(entrypoint => !pkg.items.some(item => item.importPath === entrypoint))
    if (emptyEntrypoints.length > 0)
      throw new Error(`API documentation has no public symbols for entrypoints: ${emptyEntrypoints.join(', ')}`)
  }

  for (const [name, symbol] of [['@duxweb/lumi', 'createLumi'], ['@duxweb/lumi', 'useList'], ['@duxweb/lumi-admin', 'createAdmin']]) {
    if (!byName.get(name)?.items.some(item => item.name === symbol && item.signatures.length))
      throw new Error(`Missing callable API: ${name}:${symbol}`)
  }
}

function slugify(value: string): string {
  return value
    .replace(LOWER_UPPER_RE, '$1-$2')
    .replace(UPPER_WORD_RE, '$1-$2')
    .toLowerCase()
}

function title(value: string): string {
  return value.replaceAll('-', ' ')
}

async function replaceDirectory(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true })
  await mkdir(path, { recursive: true })
}

// Larger examples (a whole gallery page) are left to the gallery and the Playground.
const MAX_EXAMPLE_ELEMENTS = 24

/** The gallery example a component page shows, cut down to that component. */
function componentExample(type: string): ReturnType<typeof focusComponentDemo> {
  const spec = Object.values(GALLERY_PAGES).map(item => focusComponentDemo(item.spec, type)).find(Boolean)
  return spec && Object.keys(spec.elements).length <= MAX_EXAMPLE_ELEMENTS ? spec : undefined
}

async function json(value: unknown): Promise<string> {
  return (await format(JSON.stringify(value), { parser: 'json', printWidth: 80 })).trimEnd()
}

async function componentPage(component: (typeof docsCatalog.components)[number]): Promise<string> {
  const lead = componentLead(component.type)
  const example = componentExample(component.type)
  const rows = component.props.map(prop => ({ ...prop, doc: propDoc(component.type, prop.name) }))
  const main = rows.filter(prop => !PLUMBING_PROPS.includes(prop.name))
  const plumbing = rows.filter(prop => PLUMBING_PROPS.includes(prop.name))
  const propRows = main.map(prop => [
    `${code(prop.name)}${prop.required ? '（必填）' : ''}`,
    [prose(prop.doc?.text ?? ''), prop.fields.length ? `字段：${prop.fields.map(field => code(`${field.name}${field.required ? '' : '?'}`)).join('、')}` : ''].filter(Boolean).join(' '),
    code(prop.typeLabel),
    prop.doc?.default ? code(prop.doc.default) : '',
  ])
  const list = (values: readonly string[]): string => values.length ? values.map(code).join('、') : '无'
  return page([
    frontmatter(component.type, firstSentence(lead)),
    // Rendered by the site only; everywhere else the Markdown below is the page.
    example && `<ComponentPreview name="${component.type}" />`,
    prose(lead),
    example && `## 示例\n\n${fence('json', await json(example))}`,
    `## 参数\n\n${main.length ? table(['参数', '说明', '类型', '默认值'], propRows) : '没有专属参数，通过 children 使用。'}`,
    plumbing.length > 0 && `通用参数：\n\n${plumbing.map(prop => `- ${code(prop.name)}：${prose(prop.doc?.text ?? '')}`).join('\n')}`,
    `## 事件与插槽\n\n- 事件：${list(component.events)}\n- 插槽：${list(component.slots)}`,
  ])
}

async function writeComponentPages(): Promise<void> {
  const categories = [...new Set(docsCatalog.components.map(component => component.category))]
  for (const category of categories)
    await replaceDirectory(join(contentRoot, 'components', category))
  await Promise.all(docsCatalog.components.map(async component => writeFile(
    join(contentRoot, 'components', component.category, `${slugify(component.type)}.mdx`),
    await componentPage(component),
  )))
  const families = [...FAMILIES.map(([family]) => family), OTHER_FAMILY]
  await writeFile(join(contentRoot, 'components', 'index.mdx'), page([
    frontmatter('组件总览', `Lumi 的 ${docsCatalog.components.length} 个组件，按用途分组，每个组件一页：说明、JSON 示例和参数表。`),
    `页面 JSON 里的 \`type\` 只能是下面这些组件。每个组件页有实时预览、可复制的 JSON 示例和完整参数表。`,
    ...families.flatMap((family) => {
      const members = docsCatalog.components.filter(component => familyOf(component.type) === family)
      return members.length
        ? [`## ${family}`, table(['组件', '作用'], members.map(component => [`[${code(component.type)}](/components/${component.category}/${slugify(component.type)}/)`, prose(leadSentence(componentLead(component.type)))]))]
        : []
    }),
  ]))
}

async function writeGallerySchemas(): Promise<void> {
  const directory = join(publicRoot, 'component-schemas')
  await replaceDirectory(directory)
  await Promise.all(Object.entries(GALLERY_PAGES).map(([name, page]) => (
    writeFile(join(directory, `${name}.json`), `${JSON.stringify(page.spec, null, 2)}\n`)
  )))
}

async function writeProtocolCatalog(): Promise<void> {
  await mkdir(publicRoot, { recursive: true })
  await writeFile(join(publicRoot, 'catalog.json'), `${JSON.stringify(docsCatalog, null, 2)}\n`)
}

const BUTTON_WHEN = '点击按钮时执行'
const JSONC_OPTIONS = { parser: 'jsonc', printWidth: 80, trailingComma: 'none', semi: false, singleQuote: true, tabWidth: 2, useTabs: false } as const
const CODE_MARK_RE = /`/gu
const SENTENCE_STOP_RE = /。$/u

/** A minimal page around an action, so the example validates like any other page. */
function actionSpec(example: ActionExample): Record<string, unknown> {
  const host = example.host ?? { id: 'button', type: 'Button', props: { label: example.label ?? example.binding.action }, event: 'press' }
  const bindings = [example.binding, ...(example.after ?? []).map(item => item.binding)]
  return { root: host.id, elements: { [host.id]: { type: host.type, props: host.props, on: { [host.event]: bindings.length > 1 ? bindings : bindings[0] }, children: [] } } }
}

/** What a param is for, short enough to sit above it as a comment. */
function paramNote(name: string, param: string): string {
  return leadSentence(ACTION_PARAM_OVERRIDES[name]?.[param] ?? ACTION_PARAMS[param] ?? '').replace(CODE_MARK_RE, '').replace(SENTENCE_STOP_RE, '')
}

/**
 * The example as commented JSON: when the action runs, and what each of its
 * params is for, from the example's own notes or the param's explanation.
 * Only what carries a comment is opened up; the formatter keeps the rest short.
 */
async function actionExample(name: string, example: ActionExample): Promise<string> {
  const event = example.host?.event ?? 'press'
  let text = JSON.stringify(actionSpec(example))
  const replace = (from: string, to: string): void => {
    if (!text.includes(from))
      throw new Error(`action example ${name}: cannot place a comment at ${from}`)
    text = text.replace(from, to)
  }
  const params = Object.entries(example.binding.params)
  if (params.length > 0) {
    const commented = params.map(([key, value]) => {
      const note = example.notes?.[key] ?? paramNote(name, key)
      return `${note ? `// ${note}\n` : ''}${JSON.stringify(key)}:${JSON.stringify(value)}`
    }).join(',\n')
    replace(`"params":${JSON.stringify(example.binding.params)}`, `"params":{\n${commented}\n}`)
  }
  // A binding that follows in the same event says why it is there.
  for (const item of example.after ?? [])
    replace(`,${JSON.stringify(item.binding)}`, `,\n// ${item.note}\n${JSON.stringify(item.binding)}`)
  replace(`"on":{"${event}":`, `"on":{\n// ${example.host?.when ?? BUTTON_WHEN}\n"${event}":`)
  return (await format(text, JSONC_OPTIONS)).trimEnd()
}

async function actionPage(name: string): Promise<string> {
  const doc = ACTION_DOCS[name]
  if (!doc)
    throw new Error(`apps/site/src/docs/reference/action-docs.ts has no entry for action ${name}`)
  const schema = actionParamSchemas[name]!
  const params = Object.entries(schema.properties ?? {})
  const examples = await Promise.all(doc.examples.map(async example => [
    example.title && `### ${example.title}`,
    example.intro && prose(example.intro),
    fence('jsonc', await actionExample(name, example)),
  ].filter(Boolean).join('\n\n')))
  return page([
    frontmatter(name, firstSentence(doc.lead)),
    prose(doc.lead),
    `## 用法\n\n${examples.join('\n\n')}`,
    `## 参数\n\n${params.length
      ? table(['参数', '说明', '类型'], params.map(([param, value]) => [
          `${code(param)}${schema.required?.includes(param) ? '（必填）' : ''}`,
          prose(ACTION_PARAM_OVERRIDES[name]?.[param] ?? ACTION_PARAMS[param] ?? ''),
          code(typeLabel(value)),
        ]))
      : '没有参数。'}`,
  ])
}

function symbolDoc(packageApis: PackageApi[], name: string): PackageApi['items'][number] {
  const item = packageApis.find(pkg => pkg.name === '@duxweb/lumi')?.items.find(entry => entry.name === name)
  if (!item)
    throw new Error(`@duxweb/lumi does not export ${name}`)
  // A hook or provider has a page of its own; a page that only shows a signature explains nothing.
  if (!item.description)
    throw new Error(`@duxweb/lumi ${name} has a reference page but no doc comment; describe it in its source`)
  return item
}

async function writeReferencePages(packageApis: PackageApi[]): Promise<void> {
  const actions = join(contentRoot, 'protocol/actions')
  await replaceDirectory(actions)
  await Promise.all(docsCatalog.actions.map(async name => writeFile(join(actions, `${slugify(name)}.mdx`), await actionPage(name))))
  await writeFile(join(actions, 'index.mdx'), page([
    frontmatter('动作总览', '页面里能调用的全部动作：读写数据、提示、导入导出、Agent 和导航。'),
    '页面通过 `on` 调用这些动作，参数是纯 JSON。每个动作一页，含用法和参数表。',
    table(['动作', '作用'], docsCatalog.actions.map(name => [`[${code(name)}](/protocol/actions/${slugify(name)}/)`, prose(leadSentence(ACTION_DOCS[name]?.lead ?? ''))])),
  ]))

  for (const [dir, names, describe] of [
    ['core/providers', docsCatalog.providers, (name: string) => `${name} 接口的方法、参数和返回值。`],
    ['core/bindings/api', docsCatalog.bindings, (name: string) => `${name} React hook 的签名、参数和返回值。`],
  ] as const) {
    const directory = join(contentRoot, dir)
    await replaceDirectory(directory)
    for (const name of names) {
      await writeFile(join(directory, `${slugify(name)}.mdx`), page([
        frontmatter(name, describe(name)),
        apiItem(symbolDoc(packageApis, name), '##', '@duxweb/lumi').replace(`## ${name}\n\n`, ''),
      ]))
    }
  }
}

async function writePackageApi(packageApis: PackageApi[]): Promise<void> {
  await mkdir(generatedRoot, { recursive: true })
  await mkdir(publicRoot, { recursive: true })
  const output = `${JSON.stringify(packageApis, null, 2)}\n`
  await Promise.all([
    writeFile(join(generatedRoot, 'api-reference.json'), output),
    writeFile(join(publicRoot, 'api-reference.json'), output),
  ])
  const directory = join(contentRoot, 'api', 'packages')
  await replaceDirectory(directory)
  await writeFile(join(contentRoot, 'api', 'index.mdx'), page([
    frontmatter('公开 API', `Lumi ${packageApis.length} 个包的公开入口和符号，由 TypeScript 源码自动生成。`),
    '只用 CDN 时不需要这些 API。用 npm 和 TypeScript 时，每个包一页，列出全部公开函数、类型、参数和返回值。',
    table(['包', '入口', '公开符号'], packageApis.map(pkg => [`[${code(pkg.name)}](/api/packages/${pkg.slug}/)`, pkg.entrypoints.map(code).join('、'), String(pkg.items.length)])),
  ]))
  const kinds: [PackageApi['items'][number]['kind'], string][] = [['function', '函数'], ['class', '类'], ['variable', '常量'], ['interface', '接口'], ['type', '类型']]
  for (const pkg of packageApis) {
    await writeFile(join(directory, `${pkg.slug}.mdx`), page([
      frontmatter(`${pkg.name} API`, `${pkg.name} 的全部公开方法、类型、参数和返回值。`),
      `${pkg.description ? `${prose(pkg.description)} ` : ''}入口：${pkg.entrypoints.map(code).join('、')}。共 ${pkg.items.length} 个公开符号，由 TypeScript 入口自动生成。`,
      ...kinds.flatMap(([kind, label]) => {
        const items = pkg.items.filter(item => item.kind === kind)
        return items.length ? [`## ${label}`, ...items.map(item => apiItem(item, '###', pkg.name))] : []
      }),
    ]))
  }
}

function sidebarLinks(prefix: string, values: readonly string[]): Array<{ label: string, slug: string }> {
  return values.map(name => ({ label: name, slug: `${prefix}/${slugify(name)}` }))
}

async function writeNavigation(packageApis: PackageApi[]): Promise<void> {
  const componentGroups = Array.from(new Set(docsCatalog.components.map(component => component.category)), category => ({
    label: categoryLabels[category] ?? title(category),
    items: sidebarLinks(
      `components/${category}`,
      docsCatalog.components.filter(component => component.category === category).map(component => component.type),
    ),
  }))

  const packageLinks = new Map(packageApis.map(pkg => [pkg.name, { label: pkg.name, slug: `api/packages/${pkg.slug}` }]))
  const packageApiGroups = [
    { label: '产品层', items: ['@duxweb/lumi', '@duxweb/lumi-ui', '@duxweb/lumi-admin'].map(name => packageLinks.get(name)!) },
    { label: '工具', items: ['@duxweb/lumi-check', '@duxweb/create-lumi'].map(name => packageLinks.get(name)!) },
  ]
  const packageApiLinks = packageApiGroups.flatMap(group => group.items)
  const generated = `/* eslint-disable style/comma-dangle, style/quote-props, style/quotes */\n// Generated by scripts/generate-docs.ts.\nexport const componentGroups = ${JSON.stringify(componentGroups, null, 2)}\n\nexport const runtimeNodeLinks = ${JSON.stringify(sidebarLinks('protocol/nodes', []), null, 2)}\n\nexport const actionLinks = ${JSON.stringify(sidebarLinks('protocol/actions', docsCatalog.actions), null, 2)}\n\nexport const commandLinks = ${JSON.stringify(sidebarLinks('protocol/commands', []), null, 2)}\n\nexport const fieldTypeLinks = ${JSON.stringify(sidebarLinks('protocol/fields/types', []), null, 2)}\n\nexport const widgetLinks = ${JSON.stringify(sidebarLinks('protocol/fields/widgets', []), null, 2)}\n\nexport const providerLinks = ${JSON.stringify(sidebarLinks('core/providers', docsCatalog.providers), null, 2)}\n\nexport const bindingLinks = ${JSON.stringify(sidebarLinks('core/bindings/api', docsCatalog.bindings), null, 2)}\n\nexport const packageApiLinks = ${JSON.stringify(packageApiLinks, null, 2)}\n\nexport const packageApiGroups = ${JSON.stringify(packageApiGroups, null, 2)}\n`
  await mkdir(generatedRoot, { recursive: true })
  await writeFile(join(generatedRoot, 'navigation.mjs'), generated)
}

const packageApis = await collectPackageApis()
assertApiCoverage(packageApis)
if (apiOnly) {
  await writePackageApi(packageApis)
  await verifyClearedDirectories()
  if (checkMode)
    await verifyGeneratedOutputInventory(root)
  process.stdout.write(`[docs] generated ${packageApis.length} package API references\n`)
}
else {
  await Promise.all([
    writeComponentPages(),
    writeGallerySchemas(),
    writeProtocolCatalog(),
    writeReferencePages(packageApis),
    writePackageApi(packageApis),
    writeNavigation(packageApis),
  ])
  await verifyClearedDirectories()
  if (checkMode)
    await verifyGeneratedOutputInventory(root)
  process.stdout.write(`[docs] generated ${docsCatalog.components.length} native component pages and ${packageApis.length} package API references\n`)
}
