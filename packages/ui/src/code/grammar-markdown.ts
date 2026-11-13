import type { CodeGrammars } from './highlight.js'
import { Emoji, GFM, parser, Subscript, Superscript } from '@lezer/markdown'

/** GitHub-flavoured Markdown, loaded on demand by the highlighter. */
export const grammars: CodeGrammars = { markdown: parser.configure([GFM, Subscript, Superscript, Emoji]) }
