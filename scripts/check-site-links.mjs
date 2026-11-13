import assert from 'node:assert/strict'
import { access, readdir, readFile } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'

const outputRoot = resolve(process.argv[2] ?? 'dist')
// The site is served from the domain root.
const base = '/'
const baseRoot = base === '/' ? '/' : base.slice(0, -1)
const attributeUrlRe = /\b(?:href|src)=(?:"([^"]*)"|'([^']*)')/gu
const fetchUrlRe = /\bfetch\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/gu
const schemeRe = /^[a-z][a-z\d+.-]*:/iu
const indexHtmlRe = /index\.html$/u
const htmlExtensionRe = /\.html$/u
const errors = []

async function files(current) {
  const result = []
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name)
    if (entry.isDirectory())
      result.push(...await files(path))
    else
      result.push(path)
  }
  return result
}

function isWithin(root, target) {
  const path = relative(root, target)
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))
}

async function exists(path) {
  try {
    await access(path)
    return true
  }
  catch {
    return false
  }
}

async function targetExists(pathname) {
  const withoutBase = base === '/'
    ? pathname.slice(1)
    : pathname === baseRoot ? '' : pathname.slice(base.length)
  let decoded
  try {
    decoded = decodeURIComponent(withoutBase)
  }
  catch {
    return false
  }
  const target = resolve(outputRoot, decoded)
  if (!isWithin(outputRoot, target))
    return false
  const candidates = extname(target) === ''
    ? [join(target, 'index.html'), `${target}.html`]
    : [target]
  for (const candidate of candidates) {
    if (await exists(candidate))
      return true
  }
  return false
}

function documentPath(file) {
  const path = relative(outputRoot, file).split(sep).join('/')
  const route = path === 'index.html' ? '' : path.replace(indexHtmlRe, '').replace(htmlExtensionRe, '')
  return `${base}${route}`
}

async function checkUrl(raw, file, kind) {
  if (!raw || raw.startsWith('#') || raw.startsWith('?') || raw.startsWith('//') || schemeRe.test(raw))
    return
  let url
  try {
    url = new URL(raw, `https://docs.local${documentPath(file)}`)
  }
  catch {
    errors.push(`${relative(outputRoot, file)}: invalid ${kind} ${JSON.stringify(raw)}`)
    return
  }
  const pathname = url.pathname
  if (base !== '/') {
    if (pathname === baseRoot)
      errors.push(`${relative(outputRoot, file)}: missing trailing slash after base in ${kind} ${JSON.stringify(raw)}`)
    if (pathname.startsWith(`${base}${base.slice(1)}`))
      errors.push(`${relative(outputRoot, file)}: double base in ${kind} ${JSON.stringify(raw)}`)
    if (pathname !== baseRoot && !pathname.startsWith(base)) {
      errors.push(`${relative(outputRoot, file)}: ${kind} escapes ${baseRoot}: ${JSON.stringify(raw)}`)
      return
    }
  }
  if (!await targetExists(pathname))
    errors.push(`${relative(outputRoot, file)}: missing target for ${kind} ${JSON.stringify(raw)}`)
}

assert(await exists(outputRoot), `Docs output does not exist: ${outputRoot}`)
for (const file of await files(outputRoot)) {
  const extension = extname(file)
  if (!['.html', '.js', '.mjs'].includes(extension))
    continue
  const source = await readFile(file, 'utf8')
  if (extension === '.html') {
    const markup = source.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/giu, '$1$2')
    for (const match of markup.matchAll(attributeUrlRe))
      await checkUrl(match[1] ?? match[2] ?? '', file, 'href/src')
  }
  for (const match of source.matchAll(fetchUrlRe))
    await checkUrl(match[1] ?? match[2] ?? match[3] ?? '', file, 'fetch')
}

if (errors.length > 0)
  throw new Error(`Docs link gate failed:\n${errors.join('\n')}`)
process.stdout.write(`Site link gate passed for ${base} (${outputRoot})\n`)
