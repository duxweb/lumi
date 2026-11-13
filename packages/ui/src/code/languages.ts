import type { CodeLanguage } from '../catalog/code-props.js'
import { CODE_LANGUAGES } from '../catalog/code.js'

const ALIASES: Record<string, CodeLanguage> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  yml: 'yaml',
  md: 'markdown',
  golang: 'go',
  htm: 'html',
  postgresql: 'sql',
  mysql: 'sql',
  sqlite: 'sql',
  plaintext: 'text',
  plain: 'text',
  txt: 'text',
}

const LABELS: Record<CodeLanguage, string> = {
  json: 'JSON',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  css: 'CSS',
  html: 'HTML',
  bash: 'Bash',
  go: 'Go',
  yaml: 'YAML',
  sql: 'SQL',
  markdown: 'Markdown',
  text: 'Text',
}

/** A language name or alias, case-insensitive; anything unknown is plain text. */
export function resolveCodeLanguage(language: string | null | undefined): CodeLanguage {
  const key = language?.trim().toLowerCase() ?? ''
  return (CODE_LANGUAGES as readonly string[]).includes(key) ? key as CodeLanguage : ALIASES[key] ?? 'text'
}

export function codeLanguageLabel(language: CodeLanguage): string {
  return LABELS[language]
}

const LINE_END = /\r\n?/g
const TRAILING_NEWLINE = /\n$/

/** Unix line ends, without the one trailing newline a file usually ends with. */
export function normalizeCode(code: string): string {
  return code.replace(LINE_END, '\n').replace(TRAILING_NEWLINE, '')
}
