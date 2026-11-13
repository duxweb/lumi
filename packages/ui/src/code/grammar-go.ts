import type { CodeGrammars } from './highlight.js'
import { parser } from '@lezer/go'

/** Go, loaded on demand by the highlighter. */
export const grammars: CodeGrammars = { go: parser }
