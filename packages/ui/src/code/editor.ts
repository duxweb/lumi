import type { StreamParser } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import type { CodeLanguage } from '../catalog/code-props.js'
import type { CodeGrammars } from './highlight.js'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { jsonLanguage } from '@codemirror/lang-json'
import { bracketMatching, indentOnInput, LanguageSupport, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder as placeholderText } from '@codemirror/view'
import { codeGrammar, loadCodeGrammar, loadOnce, lumiHighlighter, registerCodeGrammars } from './highlight.js'

export { jsonErrorOffset } from './highlight.js'

export interface CodeEditorSettings {
  language: CodeLanguage
  placeholder: string
  showLineNumbers: boolean
  wrap: boolean
  readonly: boolean
  disabled: boolean
  label: string
  invalid: boolean
  id?: string | undefined
  describedBy?: string | undefined
  /** Offset of a syntax error to underline, or null. */
  errorAt: number | null
}

export interface CodeEditorHandle {
  setValue: (value: string) => void
  configure: (settings: CodeEditorSettings) => void
  focus: (offset?: number) => void
  destroy: () => void
}

export type EditorLanguages = Partial<Record<CodeLanguage, LanguageSupport>>

const js = (): Promise<{ languages: EditorLanguages, grammars: CodeGrammars }> => import('./language-javascript.js')

// JSON ships with the editor; other languages load as chunks that also carry
// the highlighter's grammar. Bash and SQL run its stream modes.
const loaders: Partial<Record<CodeLanguage, typeof js>> = {
  javascript: js,
  typescript: js,
  jsx: js,
  tsx: js,
  css: () => import('./language-css.js'),
  html: () => import('./language-html.js'),
  markdown: () => import('./language-markdown.js'),
  go: () => import('./language-go.js'),
  yaml: () => import('./language-yaml.js'),
}

const supports = new Map<CodeLanguage, Extension>([['json', new LanguageSupport(jsonLanguage)], ['text', []]])
const loading = new Map<CodeLanguage, Promise<void>>()

// The language's extension, or undefined while it still has to load.
function languageExtension(language: CodeLanguage): Extension | undefined {
  let support = supports.get(language)
  const mode = codeGrammar(language)
  if (!support && mode && 'token' in mode)
    supports.set(language, support = StreamLanguage.define(mode as StreamParser<unknown>))
  return support
}

// Loads a language once; a failed load is forgotten so the next call retries.
export function loadEditorLanguage(language: CodeLanguage): Promise<void> {
  const load = loaders[language]
  return languageExtension(language)
    ? Promise.resolve()
    : loadOnce(loading, language, async () => {
        if (!load) {
          if (!await loadCodeGrammar(language))
            supports.set(language, [])
          return
        }
        const chunk = await load()
        registerCodeGrammars(chunk.grammars)
        for (const [name, support] of Object.entries(chunk.languages) as [CodeLanguage, LanguageSupport][])
          supports.set(name, support)
      })
}

// Editor chrome. Every value is a variable from `styles/code.css`, so the
// editor shares CodeBlock's metrics and the theme's colours; the selectors
// live here because they must out-rank CodeMirror's own base theme.
const lumiTheme = EditorView.theme({
  '&': { color: 'var(--foreground)', backgroundColor: 'transparent', fontSize: 'var(--lumi-code-font-size)', minHeight: 'inherit', maxHeight: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--lumi-code-font)', lineHeight: 'var(--lumi-code-leading)', minHeight: 'inherit', maxHeight: 'inherit', overflow: 'auto' },
  '.cm-content': { padding: 'var(--lumi-code-pad-y) 0', caretColor: 'var(--foreground)' },
  '.cm-line': { padding: '0 var(--lumi-code-pad-x)' },
  '.cm-gutters': { color: 'var(--lumi-code-gutter-fg)', border: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { boxSizing: 'content-box', minWidth: 'var(--lumi-code-gutter-min)', padding: '0 var(--lumi-code-gap) 0 var(--lumi-code-pad-x)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-activeLineGutter': { color: 'var(--foreground)' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-activeLine': { backgroundColor: 'var(--lumi-code-active-line)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--lumi-code-selection-blur)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, &.cm-focused .cm-content ::selection': { backgroundColor: 'var(--lumi-code-selection)' },
  '.cm-placeholder': { color: 'var(--lumi-code-muted)' },
  '.cm-matchingBracket, .cm-nonmatchingBracket': { backgroundColor: 'transparent', outline: 'none' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--lumi-code-bracket)' },
  '&.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'transparent', color: 'var(--lumi-code-error)' },
  '.lumi-code-error-mark': { textDecoration: 'underline wavy var(--lumi-code-error)', textDecorationSkipInk: 'none', textUnderlineOffset: '3px' },
})

const numberedLines = EditorView.theme({ '.cm-line': { paddingLeft: '0' } })

const setError = StateEffect.define<number | null>()

const errorMark = Decoration.mark({ class: 'lumi-code-error-mark' })

const errorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, transaction) {
    let next = marks.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setError))
        continue
      const at = effect.value
      if (at === null) {
        next = Decoration.none
        continue
      }
      const doc = transaction.state.doc
      const from = Math.min(Math.max(at, 0), doc.length)
      const line = doc.lineAt(from)
      // A mark needs width: at a line end it covers the character before.
      const to = from < line.to ? from + 1 : from
      const start = to === from && from > line.from ? from - 1 : from
      next = start < to ? Decoration.set([errorMark.range(start, to)]) : Decoration.none
    }
    return next
  },
  provide: field => EditorView.decorations.from(field),
})

interface SettingsExtensions {
  language: Extension
  gutter: Extension
  wrap: Extension
  access: Extension
  placeholder: Extension
}

type Slot = keyof SettingsExtensions

// What each compartment is built from, so `configure` rebuilds only the ones whose inputs changed.
function slotInputs(s: CodeEditorSettings): Record<Slot, unknown> {
  return { language: s.language, gutter: s.showLineNumbers, wrap: s.wrap, access: [s.readonly, s.disabled, s.label, s.invalid, s.id, s.describedBy].join('\n'), placeholder: s.placeholder }
}

function settingsExtensions(settings: CodeEditorSettings): SettingsExtensions {
  return {
    language: languageExtension(settings.language) ?? [],
    gutter: settings.showLineNumbers ? [lineNumbers(), highlightActiveLineGutter(), numberedLines] : [],
    wrap: settings.wrap ? EditorView.lineWrapping : [],
    access: [
      EditorState.readOnly.of(settings.readonly || settings.disabled),
      EditorView.editable.of(!settings.disabled),
      EditorView.contentAttributes.of({
        'aria-label': settings.label,
        ...(settings.invalid ? { 'aria-invalid': 'true' } : {}),
        // An explicit tab stop, so checkers that ignore contenteditable see the scroller's content as reachable.
        ...(settings.disabled ? { 'aria-disabled': 'true' } : { tabindex: '0' }),
        ...(settings.readonly ? { 'aria-readonly': 'true' } : {}),
        ...(settings.id ? { id: settings.id } : {}),
        ...(settings.describedBy ? { 'aria-describedby': settings.describedBy } : {}),
      }),
    ],
    placeholder: settings.placeholder ? placeholderText(settings.placeholder) : [],
  }
}

// A language still loading starts as plain text and switches in when it arrives.
export function mountCodeEditor(parent: HTMLElement, value: string, settings: CodeEditorSettings, onChange: (value: string) => void): CodeEditorHandle {
  const initial = settingsExtensions(settings)
  const slots = Object.fromEntries(Object.keys(initial).map(slot => [slot, new Compartment()])) as Record<Slot, Compartment>
  let current = settings
  let destroyed = false
  // Set while a value pushed in from outside is applied, so it is not echoed back as an edit.
  let syncing = false
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: value,
      extensions: [
        (Object.keys(slots) as Slot[]).map(slot => slots[slot].of(initial[slot])),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        syntaxHighlighting(lumiHighlighter),
        errorField,
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        lumiTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncing)
            onChange(update.state.doc.toString())
        }),
      ],
    }),
  })
  const ensureLanguage = (language: CodeLanguage): void => {
    if (!languageExtension(language)) {
      loadEditorLanguage(language).then(() => {
        if (!destroyed && current.language === language)
          view.dispatch({ effects: slots.language.reconfigure(languageExtension(language) ?? []) })
      }, () => {})
    }
  }
  ensureLanguage(settings.language)
  if (settings.errorAt !== null)
    view.dispatch({ effects: setError.of(settings.errorAt) })
  return {
    setValue(next) {
      const text = view.state.doc.toString()
      if (next === text)
        return
      syncing = true
      view.dispatch({ changes: { from: 0, to: text.length, insert: next } })
      syncing = false
    },
    configure(next) {
      // Only compartments whose inputs changed are rebuilt, so a moving syntax error alone just moves its mark.
      const was = slotInputs(current)
      const now = slotInputs(next)
      const changed = (Object.keys(slots) as Slot[]).filter(slot => was[slot] !== now[slot])
      const extensions = changed.length ? settingsExtensions(next) : undefined
      const effects: StateEffect<unknown>[] = changed.map(slot => slots[slot].reconfigure(extensions![slot]))
      if (next.errorAt !== current.errorAt)
        effects.push(setError.of(next.errorAt))
      current = next
      if (effects.length)
        view.dispatch({ effects })
      if (was.language !== now.language)
        ensureLanguage(next.language)
    },
    focus(offset) {
      if (offset !== undefined)
        view.dispatch({ selection: { anchor: Math.min(offset, view.state.doc.length) } })
      view.focus()
    },
    destroy() {
      destroyed = true
      view.destroy()
    },
  }
}
