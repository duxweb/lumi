import type { EditorLanguages } from './editor.js'
import { cssLanguage } from '@codemirror/lang-css'
import { LanguageSupport } from '@codemirror/language'

export { grammars } from './grammar-css.js'

export const languages = { css: new LanguageSupport(cssLanguage) } satisfies EditorLanguages
