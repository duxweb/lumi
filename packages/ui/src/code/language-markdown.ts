import type { EditorLanguages } from './editor.js'
import type { CodeGrammars } from './highlight.js'
import { markdownLanguage } from '@codemirror/lang-markdown'
import { LanguageSupport } from '@codemirror/language'
import { grammars as markdown } from './grammar-markdown.js'
import { grammars as html, languages as htmlLanguages } from './language-html.js'

// CodeMirror's Markdown language bundles its HTML language, so this chunk
// hands over everything that one carries as well.
export const grammars: CodeGrammars = { ...html, ...markdown }

export const languages = { ...htmlLanguages, markdown: new LanguageSupport(markdownLanguage) } satisfies EditorLanguages
