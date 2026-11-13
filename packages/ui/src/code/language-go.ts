import type { EditorLanguages } from './editor.js'
import { goLanguage } from '@codemirror/lang-go'
import { LanguageSupport } from '@codemirror/language'

export { grammars } from './grammar-go.js'

export const languages = { go: new LanguageSupport(goLanguage) } satisfies EditorLanguages
