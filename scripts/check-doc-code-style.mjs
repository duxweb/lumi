#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { format } from 'prettier'
import { stripJsonComments } from './jsonc.mjs'

const root = resolve(import.meta.dirname, '..')
const contentRoot = join(root, 'apps/site/src/content/docs')
const inlineCodeFiles = []
// The hard limit of a line; a comment or a string may pass the print width, not this.
const maxLineLength = 100
// Code wraps at the width of the reading column, so an example never runs under its edge.
const CODE_PRINT_WIDTH = 88
// JSON examples are read in a narrow column and match the generator's width.
const JSON_PRINT_WIDTH = 80
const errors = []
const write = process.argv.includes('--write')
// Long string values that cannot wrap: prose, image data URIs, quoted source code and packed documents.
const longJsonTextPattern = /^\s*"(?:description|message|text|content|src|url|code|packed)"\s*:/u
const multipleStatementsPattern = /;\s+(?:const|let|if|return|await|[A-Za-z_$][\w$]*\s*[=(])/u
const inlineBlockPattern = /^\s*<(?:template|script|main|div|section|form|table|thead|tbody|tr)>.*<\/(?:template|script|main|div|section|form|table|thead|tbody|tr)>\s*$/u
const unbracedIfPattern = /^\s*if\s*\([^)]*\)\s*$/u
const leadingJsxSemicolonPattern = /^\s*;</u
const leadingSemicolonPattern = /^;/u
const leadingJsxSemicolonCapturePattern = /^(\s*);(?=<)/u
const fencePattern = /^```([\w-]*)\s*$/u
// Pages written by hand; the rest is generated from the Catalog and the source.
const guidePagePattern = /^(?:guide|ai|components\/integration)\//u
// An example a reader has to work through says what its parts do.
const COMMENTED_FROM_LINES = 6
const commentPattern = /^\s*(?:\/\/|#|\/\*|<!--|\{\/\*)/u
const uncommentedLanguages = new Set(['', 'text', 'typescript'])
const inlineCodePattern = /\bcode\s*:\s*`/gu
const markupLanguagePattern = /^(?:html|jsx|tsx|vue)$/u
const openingTagPattern = /<[A-Za-z][^>]*>/gu
const inlineLanguagePattern = /language\s*:\s*'([^']+)'/u
const prettierParsers = new Map([
  ['ts', 'typescript'],
  ['tsx', 'babel-ts'],
  ['js', 'babel'],
  ['jsx', 'babel'],
  ['vue', 'vue'],
  ['json', 'json'],
  ['jsonc', 'jsonc'],
  ['css', 'css'],
  ['html', 'html'],
])
const prettierOptions = {
  printWidth: CODE_PRINT_WIDTH,
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
}

function normalizeFormattedCode(source, formatted) {
  const trimmedSource = source.trimStart().replace(leadingSemicolonPattern, '')
  if ((trimmedSource.startsWith('<') || trimmedSource.startsWith('if (') || trimmedSource.startsWith('return ('))
    && formatted.endsWith(';')) {
    return formatted.replace(leadingSemicolonPattern, '').slice(0, -1)
  }
  return formatted
}

function prepareCodeForFormat(source, language) {
  if ((language === 'tsx' || language === 'jsx') && leadingJsxSemicolonPattern.test(source))
    return source.replace(leadingJsxSemicolonCapturePattern, '$1')
  return source
}

function prettierParser(language, source) {
  if ((language === 'tsx' || language === 'jsx') && source.trimStart().startsWith('<'))
    return undefined
  return prettierParsers.get(language)
}

async function listDocs(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listDocs(path) : [path]
  }))

  return files
    .flat()
    .filter(path => ['.md', '.mdx'].includes(extname(path)))
    .sort((left, right) => left.localeCompare(right))
}

function location(path, line) {
  return `${relative(root, path)}:${line}`
}

function inspectLine(path, lineNumber, line, language, source) {
  const isLongJsonText = (language === 'json' || language === 'jsonc')
    && longJsonTextPattern.test(line)

  if (line.length > maxLineLength && !isLongJsonText) {
    errors.push(`${location(path, lineNumber)} ${source} 单行超过 ${maxLineLength} 个字符`)
  }

  if (multipleStatementsPattern.test(line)) {
    errors.push(`${location(path, lineNumber)} ${source} 一行包含多个语句`)
  }

  if (inlineBlockPattern.test(line)) {
    errors.push(`${location(path, lineNumber)} ${source} 块级标签应分行展示`)
  }

  if (unbracedIfPattern.test(line)) {
    errors.push(`${location(path, lineNumber)} ${source} 教学示例中的 if 必须使用花括号`)
  }

  if ((language === 'tsx' || language === 'jsx') && leadingJsxSemicolonPattern.test(line)) {
    errors.push(`${location(path, lineNumber)} ${source} JSX 示例不应包含格式化器注入的前导分号`)
  }

  if (markupLanguagePattern.test(language)) {
    const openingTags = [...line.matchAll(openingTagPattern)]
    if (openingTags.length > 1) {
      errors.push(`${location(path, lineNumber)} ${source} 一行包含多个标签`)
    }
  }
}

async function inspectFences(path) {
  const lines = (await readFile(path, 'utf8')).split('\n')
  const output = []
  let block

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const fence = line.match(fencePattern)

    if (fence) {
      if (!block) {
        block = {
          language: fence[1],
          line: index + 1,
          lines: [],
        }
        output.push(line)
      }
      else {
        const source = block.lines.join('\n')
        const parser = prettierParser(block.language, source)
        let checkedSource = source

        if (parser) {
          try {
            const formatted = normalizeFormattedCode(
              source,
              (await format(prepareCodeForFormat(source, block.language), { ...prettierOptions, parser, ...(parser === 'json' || parser === 'jsonc' ? { printWidth: JSON_PRINT_WIDTH, trailingComma: 'none' } : {}) })).trimEnd(),
            )
            if (source.trimEnd() !== formatted) {
              if (write)
                checkedSource = formatted
              else
                errors.push(`${location(path, block.line)} 代码块未使用统一格式，请运行 pnpm -F @duxweb/lumi-site format:code`)
            }
          }
          catch {
            // Some lessons intentionally show a partial object or expression.
          }
        }

        if (block.language === 'json' || block.language === 'jsonc') {
          try {
            JSON.parse(block.language === 'jsonc' ? stripJsonComments(checkedSource) : checkedSource)
          }
          catch (error) {
            errors.push(`${location(path, block.line)} JSON 示例不是完整可解析的 JSON：${error.message}`)
          }
        }

        const codeLines = checkedSource.split('\n').filter(codeLine => codeLine.trim())
        if (guidePagePattern.test(relative(contentRoot, path))
          && !uncommentedLanguages.has(block.language)
          && codeLines.length >= COMMENTED_FROM_LINES
          && !codeLines.some(codeLine => commentPattern.test(codeLine))) {
          errors.push(`${location(path, block.line)} 代码块没有注释：${COMMENTED_FROM_LINES} 行以上的示例要说明每一部分在做什么`)
        }

        // `typescript` fences hold generated declarations, quoted from the
        // source as they are, not examples written for the reader to copy.
        if (block.language !== 'typescript') {
          checkedSource.split('\n').forEach((codeLine, offset) => {
            inspectLine(path, block.line + offset + 1, codeLine, block.language, '代码块')
          })
        }
        output.push(...checkedSource.split('\n'), line)
        block = undefined
      }

      continue
    }

    if (!block)
      output.push(line)

    if (!block)
      continue

    block.lines.push(line)
  }

  if (block) {
    errors.push(`${location(path, block.line)} 代码块没有闭合`)
  }

  if (write)
    await writeFile(path, output.join('\n'))
}

function readTemplate(source, start) {
  let code = ''

  for (let index = start; index < source.length; index++) {
    const character = source[index]

    if (character === '`' && source[index - 1] !== '\\') {
      return { code, end: index }
    }

    if (character === '\\' && source[index + 1] === 'n') {
      code += '\n'
      index++
      continue
    }

    code += character
  }

  return undefined
}

async function inspectInlineCode(path) {
  let source = await readFile(path, 'utf8')
  const replacements = []
  for (const match of source.matchAll(inlineCodePattern)) {
    const start = match.index + match[0].length
    const template = readTemplate(source, start)

    if (!template) {
      const line = source.slice(0, start).split('\n').length
      errors.push(`${location(path, line)} CodeTabs 的 code 模板没有闭合`)
      continue
    }

    const firstLine = source.slice(0, start).split('\n').length
    const language = source
      .slice(Math.max(0, match.index - 120), match.index)
      .match(inlineLanguagePattern)?.[1] ?? ''

    let checkedCode = template.code
    const parser = prettierParser(language, template.code)
    if (parser) {
      try {
        const formatted = normalizeFormattedCode(
          template.code,
          (await format(prepareCodeForFormat(template.code, language), { ...prettierOptions, parser, ...(parser === 'json' || parser === 'jsonc' ? { printWidth: JSON_PRINT_WIDTH, trailingComma: 'none' } : {}) })).trimEnd(),
        )
        if (template.code.trimEnd() !== formatted) {
          if (write) {
            checkedCode = formatted
            replacements.push({ start, end: template.end, code: formatted })
          }
          else {
            errors.push(`${location(path, firstLine)} CodeTabs 示例未使用统一格式，请运行 pnpm -F @duxweb/lumi-site format:code`)
          }
        }
      }
      catch {
        // Partial JSX and escaped template examples are checked by the structural rules below.
      }
    }

    checkedCode.split('\n').forEach((line, offset) => {
      inspectLine(path, firstLine + offset, line, language, 'CodeTabs 示例')
    })
  }

  if (write && replacements.length > 0) {
    replacements.sort((left, right) => right.start - left.start).forEach((replacement) => {
      source = `${source.slice(0, replacement.start)}${replacement.code}${source.slice(replacement.end)}`
    })
    await writeFile(path, source)
  }
}

const docs = await listDocs(contentRoot)
for (const path of docs)
  await inspectFences(path)
for (const path of [...docs, ...inlineCodeFiles])
  await inspectInlineCode(path)

if (errors.length > 0) {
  console.error(`文档代码风格检查失败（${errors.length} 处）：`)
  errors.forEach(error => console.error(`- ${error}`))
  process.exitCode = 1
}
else {
  console.log(`文档代码风格${write ? '格式化' : '检查'}通过：${docs.length} 个文档文件`)
}
