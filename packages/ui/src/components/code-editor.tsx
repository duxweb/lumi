import type { CSSProperties, ReactElement } from 'react'
import type { CodeEditorProps } from '../catalog/types-public.js'
import type { CodeEditorHandle, CodeEditorSettings } from '../code/editor.js'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { resolveCodeLanguage } from '../code/languages.js'
import { FIELD_BARE, FIELD_DISABLED_WITHIN, FIELD_FOCUS_WITHIN, FIELD_SURFACE } from '../internal/field-surface.js'
import { cn } from '../internal/utils.js'
import { useControllableValue } from './control.js'
import { useUiText } from './text.js'

interface HostProps {
  'className'?: string
  'id'?: string
  'aria-describedby'?: string
  'data-testid'?: string
}

type EditorModule = typeof import('../code/editor.js')

let editorModule: EditorModule | undefined
let pending: Promise<EditorModule> | undefined

function loadEditor(): Promise<EditorModule> {
  pending ??= import('../code/editor.js').then((module) => {
    editorModule = module
    return module
  }, (error: unknown) => {
    pending = undefined
    throw error
  })
  return pending
}

const POSITION = /position (\d+)/

interface JsonIssue { line: number, column: number, offset: number }

function lineColumn(text: string, offset: number): JsonIssue {
  const before = text.slice(0, offset).split('\n')
  return { offset, line: before.length, column: before.at(-1)!.length + 1 }
}

/** The first JSON syntax error in `text`, located by the editor's grammar once loaded. */
function jsonSyntaxError(text: string, module: EditorModule | undefined): JsonIssue | null {
  if (!text.trim())
    return null
  try {
    JSON.parse(text)
    return null
  }
  catch (error) {
    const reported = POSITION.exec(error instanceof Error ? error.message : '')
    const offset = module?.jsonErrorOffset(text) ?? (reported ? Number(reported[1]) : text.length)
    return lineColumn(text, Math.min(offset, text.length))
  }
}

/**
 * A CodeMirror editor that loads on first mount. Until it arrives, and if it
 * cannot load, a plain textarea with the same metrics holds the value, so the
 * field neither jumps nor stops working.
 */
export function LumiCodeEditor(props: CodeEditorProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { value, defaultValue = '', onChange, language, placeholder = '', showLineNumbers = true, wrap = false, minHeight, maxHeight = 400, checkSyntax, name, disabled = false, readonly = false, invalid, error, ariaLabel, className, id } = props
  const [current, setCurrent] = useControllableValue(value ?? undefined, defaultValue, onChange)
  const text = current ?? ''
  const lang = resolveCodeLanguage(language)
  const label = ariaLabel ?? props['aria-label'] ?? t('lumi.code.editor', 'Code editor')
  const host = useRef<HTMLDivElement>(null)
  const fallback = useRef<HTMLTextAreaElement>(null)
  const handle = useRef<CodeEditorHandle | null>(null)
  const latest = useRef({ text, setCurrent })
  latest.current = { text, setCurrent }
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const errorId = useId()

  const syntax = useMemo(() => checkSyntax && lang === 'json' ? jsonSyntaxError(text, status === 'ready' ? editorModule : undefined) : null, [checkSyntax, lang, text, status])
  const message = error ?? (syntax ? t('lumi.code.invalidJson', 'Invalid JSON at line {line}, column {column}', { line: syntax.line, column: syntax.column }) : undefined)
  const isInvalid = Boolean(invalid || syntax)
  const describedBy = [props['aria-describedby'], message ? errorId : undefined].filter(Boolean).join(' ') || undefined
  const settings: CodeEditorSettings = { language: lang, placeholder, showLineNumbers, wrap, readonly, disabled, label, invalid: isInvalid, id, describedBy, errorAt: syntax?.offset ?? null }
  const latestSettings = useRef(settings)
  latestSettings.current = settings

  useEffect(() => {
    let live = true
    // The language chunk loads before mounting so the editor does not flash plain text;
    // if it fails the editor mounts anyway and retries it.
    loadEditor().then(module => module.loadEditorLanguage(latestSettings.current.language).then(() => module, () => module)).then((module) => {
      if (!live || !host.current)
        return
      const typing = document.activeElement === fallback.current ? fallback.current?.selectionStart : undefined
      handle.current = module.mountCodeEditor(host.current, latest.current.text, latestSettings.current, next => latest.current.setCurrent(next))
      setStatus('ready')
      if (typing !== undefined)
        handle.current.focus(typing)
    }, () => {
      if (live)
        setStatus('error')
    })
    return () => {
      live = false
      handle.current?.destroy()
      handle.current = null
    }
  }, [])

  useEffect(() => {
    handle.current?.setValue(text)
  }, [text, status])

  // The handle compares each compartment's inputs itself, so a moving syntax
  // error only re-dispatches the error mark.
  const configKey = JSON.stringify(settings)
  useEffect(() => {
    handle.current?.configure(latestSettings.current)
  }, [configKey, status])

  const size = { minHeight, maxHeight } as CSSProperties
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)} data-slot="code-editor" data-status={status} data-line-numbers={showLineNumbers || undefined} data-testid={props['data-testid']}>
      {name && <input type="hidden" name={name} value={text} disabled={disabled} />}
      <div
        className={cn(FIELD_SURFACE, FIELD_FOCUS_WITHIN, FIELD_DISABLED_WITHIN, 'lumi-code-frame relative w-full min-w-0 overflow-hidden p-px transition-colors')}
        data-slot="code-editor-frame"
        data-invalid={isInvalid || undefined}
        data-disabled={disabled || undefined}
        data-language={lang}
      >
        <div ref={host} className="lumi-code-host" style={size} />
        {status !== 'ready' && (
          <textarea
            ref={fallback}
            id={id}
            className={cn(FIELD_BARE, 'lumi-code-fallback')}
            style={size}
            value={text}
            placeholder={placeholder}
            aria-label={label}
            aria-invalid={isInvalid || undefined}
            aria-describedby={describedBy}
            readOnly={readonly}
            disabled={disabled}
            spellCheck={false}
            data-wrap={wrap || undefined}
            onChange={event => setCurrent(event.target.value)}
          />
        )}
      </div>
      {message && <p id={errorId} role="alert" className="text-meta text-destructive" data-slot="code-editor-error">{message}</p>}
    </div>
  )
}
