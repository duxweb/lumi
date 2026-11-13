import type { EditorLanguages } from './editor.js'
import { htmlLanguage } from '@codemirror/lang-html'
import { LanguageSupport } from '@codemirror/language'
import { languages as css } from './language-css.js'
import { languages as js } from './language-javascript.js'

// CodeMirror's HTML language bundles its JavaScript and CSS languages, so this
// chunk hands those over as well.
export { grammars } from './grammar-html.js'

export const languages = { ...js, ...css, html: new LanguageSupport(htmlLanguage) } satisfies EditorLanguages
