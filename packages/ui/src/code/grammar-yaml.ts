import type { CodeGrammars } from './highlight.js'
import { parser } from '@lezer/yaml'

/** YAML, loaded on demand by the highlighter. */
export const grammars: CodeGrammars = { yaml: parser }
