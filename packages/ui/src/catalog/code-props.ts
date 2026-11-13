import type { z } from 'zod'
import type { CODE_LANGUAGES, codeDefinitions } from './code.js'

type Definitions = typeof codeDefinitions

export type CodeLanguage = typeof CODE_LANGUAGES[number]

export type CodeFile = NonNullable<z.input<Definitions['CodeBlock']['props']>['files']>[number]

export type CodeEditorProps = z.input<Definitions['CodeEditor']['props']> & {
  onChange?: ((value: string) => void) | undefined
}
