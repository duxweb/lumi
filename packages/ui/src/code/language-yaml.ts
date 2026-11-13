import type { EditorLanguages } from './editor.js'
import { yamlLanguage } from '@codemirror/lang-yaml'
import { LanguageSupport } from '@codemirror/language'

export { grammars } from './grammar-yaml.js'

export const languages = { yaml: new LanguageSupport(yamlLanguage) } satisfies EditorLanguages
