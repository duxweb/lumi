import type { CodeGrammars } from './highlight.js'
import { parser as cssParser } from '@lezer/css'
import { configureNesting, parser } from '@lezer/html'
import { parser as jsParser } from '@lezer/javascript'
import { grammars as css } from './grammar-css.js'
import { grammars as js, parsers as scripts } from './grammar-javascript.js'

const JSON_SCRIPT_TYPE = /^(?:importmap|speculationrules|application\/(?:.+\+)?json)$/i
const JS_SCRIPT_TYPE = /^(?:text|application)\/(?:x-)?(?:java|ecma)script$|^module$|^$/i
const CSS_STYLE_TYPE = /^(?:text\/)?(?:x-)?(?:stylesheet|css)$/i

/** `<script>` and `<style>` content as the editor's HTML language nests it. */
const nesting = configureNesting([
  { tag: 'script', attrs: attrs => attrs.type === 'text/typescript' || attrs.lang === 'ts', parser: scripts.typescript },
  { tag: 'script', attrs: attrs => attrs.type === 'text/babel' || attrs.type === 'text/jsx', parser: scripts.jsx },
  { tag: 'script', attrs: attrs => attrs.type === 'text/typescript-jsx', parser: scripts.tsx },
  { tag: 'script', attrs: attrs => JSON_SCRIPT_TYPE.test(attrs.type ?? ''), parser: jsParser.configure({ top: 'SingleExpression' }) },
  { tag: 'script', attrs: attrs => !attrs.type || JS_SCRIPT_TYPE.test(attrs.type), parser: scripts.javascript },
  { tag: 'style', attrs: attrs => (!attrs.lang || attrs.lang === 'css') && (!attrs.type || CSS_STYLE_TYPE.test(attrs.type)), parser: cssParser },
], [{ name: 'style', parser: cssParser.configure({ top: 'Styles' }) }])

/**
 * HTML with nested scripts and styles. The JavaScript and CSS grammars ship in
 * this chunk's dependencies anyway, so they are handed over too.
 */
export const grammars: CodeGrammars = { ...js, ...css, html: parser.configure({ wrap: nesting }) }
