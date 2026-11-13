import type { Parser } from '@lezer/common'
import type { CodeGrammars } from './highlight.js'
import { parser } from '@lezer/javascript'

/** JavaScript and its dialects, loaded on demand by the highlighter. */
export const parsers: Record<'javascript' | 'typescript' | 'jsx' | 'tsx', Parser> = {
  javascript: parser,
  typescript: parser.configure({ dialect: 'ts' }),
  jsx: parser.configure({ dialect: 'jsx' }),
  tsx: parser.configure({ dialect: 'jsx ts' }),
}

export const grammars: CodeGrammars = parsers
