import type { StreamParser } from '@codemirror/streamparser'
import type { CodeGrammars } from './highlight.js'
import { standardSQL } from '@codemirror/legacy-modes/mode/sql'

/** Standard SQL as a CodeMirror stream mode, loaded on demand. */
export const grammars: CodeGrammars = { sql: standardSQL as StreamParser<unknown> }
