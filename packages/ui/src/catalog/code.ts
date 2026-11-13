import { ValidationCheckSchema } from '@json-render/core'
import { z } from 'zod'

/** Languages with a grammar; any other `language` renders as plain text. */
export const CODE_LANGUAGES = ['json', 'javascript', 'typescript', 'jsx', 'tsx', 'css', 'html', 'bash', 'go', 'yaml', 'sql', 'markdown', 'text'] as const

const host = {
  'className': z.string().optional(),
  'data-testid': z.string().optional(),
  'aria-label': z.string().optional(),
}

const languageSchema = z.string().optional()

const codeFileSchema = z.strictObject({
  title: z.string(),
  language: languageSchema,
  code: z.string(),
})

export const codeDefinitions = {
  CodeBlock: {
    props: z
      .strictObject({
        code: z.string().optional(),
        /** `json`, `javascript`, `typescript`, `jsx`, `tsx`, `css`, `html`, `bash`, `go`, `yaml`, `sql`, `markdown`; aliases such as `ts`, `sh` or `yml` work too. */
        language: languageSchema,
        /** A filename or caption in the header bar. */
        title: z.string().optional(),
        /** Several files as tabs, each `{ title, language?, code }`; replaces `code`. */
        files: z.array(codeFileSchema).min(1).optional(),
        showLineNumbers: z.boolean().optional(),
        /** 1-based line numbers to mark, e.g. `[2, 5]`. */
        highlightLines: z.array(z.number().int().positive()).optional(),
        /** Wraps long lines instead of scrolling sideways. */
        wrap: z.boolean().optional(),
        /** Tallest the code area grows, in pixels, before it scrolls. Defaults to 400. */
        maxHeight: z.number().int().positive().optional(),
        /** Shows a copy button. Defaults to true. */
        copyable: z.boolean().optional(),
        collapsible: z.boolean().optional(),
        defaultOpen: z.boolean().optional(),
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'Read-only source with syntax highlighting for JSON, JavaScript/TypeScript (JSX/TSX), CSS, HTML, Bash, Go, YAML, SQL and Markdown; other languages show as plain text. Plain text renders first and the highlighting fills in without moving anything. `title` adds a header bar, `files` shows several files as tabs, and the copy button copies the current file. `showLineNumbers`, `highlightLines`, `wrap` and `maxHeight` shape the code area, which scrolls inside a keyboard-reachable region; `collapsible` folds it behind its title.',
  },
  CodeEditor: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        /** Same languages and aliases as CodeBlock. */
        language: languageSchema,
        placeholder: z.string().optional(),
        /** Defaults to true. */
        showLineNumbers: z.boolean().optional(),
        wrap: z.boolean().optional(),
        /** Smallest editor height in pixels; defaults to eight lines. */
        minHeight: z.number().int().positive().optional(),
        /** Tallest editor height in pixels before it scrolls; defaults to 400. */
        maxHeight: z.number().int().positive().optional(),
        /** For `json`: shows the first syntax error under the editor and marks it invalid. */
        checkSyntax: z.boolean().optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        error: z.string().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'Edits source code with the same highlighting as CodeBlock, line numbers, bracket matching, auto-indent and undo. The value is the text; bind it with `$bindState` like any input. Tab indents; press Escape, then Tab, to move focus on. `checkSyntax` reports JSON syntax errors. The editor loads on first use, behind a plain text field of the same size.',
  },
}
