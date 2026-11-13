import type { StreamParser } from '@codemirror/streamparser'
import type { CodeGrammars } from './highlight.js'
import { shell } from '@codemirror/legacy-modes/mode/shell'

/** Bash as a CodeMirror stream mode, loaded on demand. */
export const grammars: CodeGrammars = { bash: shell as StreamParser<unknown> }
