import type { CodeGrammars } from './highlight.js'
import { parser } from '@lezer/css'

/** CSS, loaded on demand by the highlighter. */
export const grammars: CodeGrammars = { css: parser }
