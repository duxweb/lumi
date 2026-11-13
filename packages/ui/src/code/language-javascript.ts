import type { EditorLanguages } from './editor.js'
import { javascriptLanguage, jsxLanguage, tsxLanguage, typescriptLanguage } from '@codemirror/lang-javascript'
import { LanguageSupport } from '@codemirror/language'

// The editor chunk re-exports the highlighter's grammars it already carries,
// so the two share one chunk per grammar instead of splitting a third.
export { grammars } from './grammar-javascript.js'

export const languages = {
  javascript: new LanguageSupport(javascriptLanguage),
  typescript: new LanguageSupport(typescriptLanguage),
  jsx: new LanguageSupport(jsxLanguage),
  tsx: new LanguageSupport(tsxLanguage),
} satisfies EditorLanguages
