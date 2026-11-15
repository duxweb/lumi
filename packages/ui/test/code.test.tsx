// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import type { ReactNode } from 'react'
import type { CodeLine } from '../src/code/highlight.js'
import { createStateStore } from '@json-render/core'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { uiComponentDefinitions } from '../src/catalog/definitions.js'
import { codeGrammar, highlightLines, loadCodeGrammar } from '../src/code/highlight.js'
import { resolveCodeLanguage } from '../src/code/languages.js'
import { loadCodeHighlighter, LumiCodeBlock } from '../src/components/code-block.js'
import { LumiCodeEditor } from '../src/components/code-editor.js'
import { uiRegistry } from '../src/react/index.js'

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

beforeAll(() => {
  // CodeMirror measures text through ranges, which jsdom does not lay out.
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }
  Range.prototype.getClientRects = (() => Object.assign([], { item: () => null })) as unknown as typeof Range.prototype.getClientRects
  Range.prototype.getBoundingClientRect = (() => rect) as unknown as typeof Range.prototype.getBoundingClientRect
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
})

/** Lets lazily imported chunks resolve and their state updates land. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 5; index++)
      await new Promise(resolve => setTimeout(resolve, 0))
  })
}

/** Settles until `check` holds; the first editor load transforms a large chunk. */
async function until(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !check(); attempt++)
    await settle()
  expect(check()).toBe(true)
}

async function mount(element: ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  await act(async () => root.render(element))
  await settle()
  return host
}

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  vi.restoreAllMocks()
})

function classesOf(line: CodeLine): Record<string, string> {
  return Object.fromEntries(line.filter(token => token.className).map(token => [token.text, token.className!]))
}

describe('catalog', () => {
  it('parses the code block and editor props and rejects the retired label', () => {
    const block = uiComponentDefinitions.CodeBlock.props
    expect(block.safeParse({ code: 'a', language: 'ts', title: 'a.ts', showLineNumbers: true, highlightLines: [2, 5], wrap: true, maxHeight: 240, copyable: false }).success).toBe(true)
    expect(block.safeParse({ files: [{ title: 'page.json', language: 'json', code: '{}' }, { title: 'main.go', code: 'package main' }] }).success).toBe(true)
    expect(block.safeParse({ code: 'a', label: 'Request' }).success).toBe(false)
    expect(block.safeParse({ code: 'a', highlightLines: [0] }).success).toBe(false)
    expect(block.safeParse({ files: [] }).success).toBe(false)
    const editor = uiComponentDefinitions.CodeEditor
    expect(editor.events).toEqual(['change'])
    expect(editor.props.safeParse({ value: '{}', language: 'json', checkSyntax: true, minHeight: 120, maxHeight: 300, readonly: true, checks: [{ type: 'required', message: 'Required' }] }).success).toBe(true)
    expect(Object.keys(uiRegistry)).toEqual(expect.arrayContaining(['CodeBlock', 'CodeEditor']))
  })

  it('resolves names and aliases, and treats anything else as plain text', () => {
    expect(resolveCodeLanguage('TS')).toBe('typescript')
    expect(resolveCodeLanguage('sh')).toBe('bash')
    expect(resolveCodeLanguage('yml')).toBe('yaml')
    expect(resolveCodeLanguage('golang')).toBe('go')
    expect(resolveCodeLanguage('http')).toBe('text')
    expect(resolveCodeLanguage(undefined)).toBe('text')
  })
})

describe('grammar chunks', () => {
  it('ships JSON with the highlighter and loads every other grammar on demand', async () => {
    expect(highlightLines('{"a": 1}', 'json')).not.toBeNull()
    expect(codeGrammar('yaml')).toBeUndefined()
    expect(highlightLines('a: 1', 'yaml')).toBeNull()
    await expect(loadCodeGrammar('yaml')).resolves.toBe(true)
    expect(highlightLines('a: 1', 'yaml')![0]!.length).toBeGreaterThan(1)
    await expect(loadCodeGrammar('text')).resolves.toBe(false)
  })

  it('hands over the grammars an HTML chunk carries anyway', async () => {
    await loadCodeGrammar('html')
    expect(codeGrammar('css')).toBeDefined()
    expect(codeGrammar('typescript')).toBeDefined()
  })
})

describe('highlighter', () => {
  beforeAll(async () => {
    await Promise.all((['go', 'tsx', 'html', 'bash', 'sql'] as const).map(loadCodeGrammar))
  })

  it('classes Lezer grammars through the shared tag map', () => {
    const [json] = highlightLines('{"total": 12, "paid": true, "note": null, "id": "a"}', 'json')!
    expect(classesOf(json!)).toMatchObject({ '"total"': 'lumi-tok-property', '12': 'lumi-tok-literal', 'true': 'lumi-tok-literal', 'null': 'lumi-tok-literal', '"a"': 'lumi-tok-string', '{': 'lumi-tok-punctuation' })
    const go = highlightLines('func List() error {\n\treturn nil // done\n}', 'go')!
    expect(go).toHaveLength(3)
    expect(classesOf(go[0]!)).toMatchObject({ func: 'lumi-tok-keyword', List: 'lumi-tok-function', error: 'lumi-tok-type' })
    expect(classesOf(go[1]!)).toMatchObject({ 'return': 'lumi-tok-keyword', '// done': 'lumi-tok-comment' })
    const [tsx] = highlightLines('const a = <b className="x" />', 'tsx')!
    expect(classesOf(tsx!)).toMatchObject({ 'const': 'lumi-tok-keyword', 'b': 'lumi-tok-tag', 'className': 'lumi-tok-property', '"x"': 'lumi-tok-string' })
    const html = highlightLines('<style>a { color: red }</style>', 'html')!
    expect(classesOf(html[0]!)).toMatchObject({ style: 'lumi-tok-tag', color: 'lumi-tok-property' })
  })

  it('runs stream modes for Bash and SQL with the same classes', () => {
    const [bash] = highlightLines('echo "hi" --force # note', 'bash')!
    expect(classesOf(bash!)).toMatchObject({ 'echo': 'lumi-tok-function', '"hi"': 'lumi-tok-string', '--force': 'lumi-tok-property', '# note': 'lumi-tok-comment' })
    const [sql] = highlightLines('SELECT id FROM orders WHERE total > 10', 'sql')!
    expect(classesOf(sql!)).toMatchObject({ SELECT: 'lumi-tok-keyword', FROM: 'lumi-tok-keyword', 10: 'lumi-tok-literal' })
    expect(highlightLines('plain', 'text')).toBeNull()
  })
})

describe('code block', () => {
  it('renders plain lines first, then the same lines highlighted', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    roots.push({ root, host })
    act(() => root.render(<LumiCodeBlock language="json" code={'{\n  "a": 1\n}\n'} showLineNumbers highlightLines={[2]} />))
    const pre = host.querySelector('pre')!
    expect(pre.getAttribute('role')).toBe('group')
    expect(pre.getAttribute('aria-label')).toBe('JSON source')
    expect(host.querySelectorAll('.lumi-code-line')).toHaveLength(3)
    expect(pre.textContent).toBe('1{2  "a": 13}')
    await act(async () => {
      await loadCodeHighlighter()
    })
    await settle()
    expect(host.querySelectorAll('.lumi-code-line')).toHaveLength(3)
    expect(pre.textContent).toBe('1{2  "a": 13}')
    expect(host.querySelector('.lumi-tok-property')?.textContent).toBe('"a"')
    const lines = host.querySelectorAll('.lumi-code-line')
    expect(lines[1]!.hasAttribute('data-highlighted')).toBe(true)
    expect(lines[0]!.hasAttribute('data-highlighted')).toBe(false)
    expect(host.querySelector('.lumi-code-ln')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows a title bar and switches files with tabs', async () => {
    const host = await mount(
      <LumiCodeBlock files={[{ title: 'page.json', language: 'json', code: '{}' }, { title: 'main.go', language: 'go', code: 'package main' }]} />,
    )
    const tabs = host.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    expect(Array.from(tabs, tab => tab.textContent)).toEqual(['page.json', 'main.go'])
    expect(host.querySelector('[role="tabpanel"]')!.textContent).toBe('{}')
    await act(async () => {
      tabs[1]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    })
    await settle()
    expect(host.querySelector('[role="tabpanel"]')!.textContent).toBe('package main')
    expect(host.querySelector('.lumi-tok-keyword')?.textContent).toBe('package')

    const titled = await mount(<LumiCodeBlock title="handler.go" language="go" code="package main" />)
    expect(titled.querySelector('[data-slot="code-block-title"]')!.textContent).toBe('handler.go')
    expect(titled.querySelector('[data-slot="code-block-header"] [data-slot="code-block-copy"]')).not.toBeNull()
  })

  it('folds behind its title when collapsible', async () => {
    const host = await mount(<LumiCodeBlock collapsible title="View response" language="json" code="{}" />)
    const details = host.querySelector('details[data-slot="code-block"]')!
    expect(details.hasAttribute('open')).toBe(false)
    expect(details.querySelector('summary')!.textContent).toBe('View response')
    expect(details.querySelector('pre')!.textContent).toBe('{}')
  })

  it('copies the raw code and confirms for a moment', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const code = 'echo "hi"\n'
    const host = await mount(<LumiCodeBlock language="bash" code={code} />)
    const button = host.querySelector<HTMLButtonElement>('[data-slot="code-block-copy"]')!
    expect(button.getAttribute('data-floating')).toBe('true')
    expect(button.getAttribute('aria-label')).toBe('Copy code')
    vi.useFakeTimers()
    try {
      await act(async () => {
        button.click()
      })
      expect(writeText).toHaveBeenCalledWith(code)
      expect(button.getAttribute('aria-label')).toBe('Copied')
      expect(host.querySelector('[role="status"]')!.textContent).toBe('Copied')
      await act(async () => {
        vi.advanceTimersByTime(2100)
      })
      expect(button.getAttribute('aria-label')).toBe('Copy code')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('leaves the copy button out when copyable is false', async () => {
    const host = await mount(<LumiCodeBlock code="x" copyable={false} />)
    expect(host.querySelector('[data-slot="code-block-copy"]')).toBeNull()
  })
})

describe('code editor', () => {
  it('holds the value in a same-size text field until the editor loads', async () => {
    const onChange = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    roots.push({ root, host })
    act(() => root.render(<LumiCodeEditor defaultValue="a = 1" language="toml" name="config" ariaLabel="Config" onChange={onChange} />))
    const fallback = host.querySelector('textarea')!
    expect(fallback.value).toBe('a = 1')
    expect(fallback.getAttribute('aria-label')).toBe('Config')
    expect(host.querySelector<HTMLInputElement>('input[type="hidden"][name="config"]')!.value).toBe('a = 1')
    await until(() => host.querySelector('textarea') === null)
    const content = host.querySelector('.cm-content')!
    expect(content.getAttribute('aria-label')).toBe('Config')
    expect(content.textContent).toBe('a = 1')
  })

  it('binds to state both ways through the registry', async () => {
    const store = createStateStore({ source: '{"a": 1}' })
    const spec: Spec = {
      root: 'editor',
      elements: { editor: { type: 'CodeEditor', props: { value: { $bindState: '/source' }, language: 'json', ariaLabel: 'Source' }, children: [] } },
    }
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store}>
        <Renderer registry={uiRegistry} spec={spec} />
      </JSONUIProvider>,
    )
    await until(() => host.querySelector('.cm-editor') !== null)
    const { EditorView } = await import('@codemirror/view')
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!
    expect(view.state.doc.toString()).toBe('{"a": 1}')
    await act(async () => {
      view.dispatch({ changes: { from: 7, insert: '2' } })
    })
    expect(store.get('/source')).toBe('{"a": 12}')
    await act(async () => {
      store.set('/source', '[]')
    })
    await settle()
    expect(view.state.doc.toString()).toBe('[]')
  })

  it('reports the first JSON syntax error and marks the field invalid', async () => {
    const host = await mount(<LumiCodeEditor value={'{\n  "a": 1,\n}'} language="json" checkSyntax ariaLabel="Config" />)
    await until(() => host.querySelector('.cm-editor') !== null)
    const error = host.querySelector('[data-slot="code-editor-error"]')!
    expect(error.textContent).toBe('Invalid JSON at line 3, column 1')
    expect(host.querySelector('[data-slot="code-editor-frame"]')!.hasAttribute('data-invalid')).toBe(true)
    const content = host.querySelector('.cm-content')!
    expect(content.getAttribute('aria-invalid')).toBe('true')
    expect(content.getAttribute('aria-describedby')).toBe(error.id)
    expect(host.querySelector('.lumi-code-error-mark')?.textContent).toBe('}')

    const valid = await mount(<LumiCodeEditor value={'{"a": 1}'} language="json" checkSyntax ariaLabel="Config" />)
    expect(valid.querySelector('[data-slot="code-editor-error"]')).toBeNull()
    expect(valid.querySelector('[data-slot="code-editor-frame"]')!.hasAttribute('data-invalid')).toBe(false)
  })

  it('locks a disabled editor and keeps a read-only one focusable', async () => {
    const host = await mount(
      <>
        <LumiCodeEditor defaultValue="x" disabled ariaLabel="Disabled" />
        <LumiCodeEditor defaultValue="y" readonly ariaLabel="Read only" />
      </>,
    )
    await until(() => host.querySelectorAll('.cm-content').length === 2)
    const [disabled, readonly] = Array.from(host.querySelectorAll('.cm-content'))
    expect(disabled!.getAttribute('contenteditable')).toBe('false')
    expect(disabled!.getAttribute('aria-disabled')).toBe('true')
    expect(host.querySelector('[data-slot="code-editor-frame"]')!.hasAttribute('data-disabled')).toBe(true)
    expect(readonly!.getAttribute('contenteditable')).toBe('true')
    expect(readonly!.getAttribute('aria-readonly')).toBe('true')
  })

  it('reconfigures only what changed, so a moving syntax error does not rebuild the gutter', async () => {
    const { mountCodeEditor } = await import('../src/code/editor.js')
    const { EditorView } = await import('@codemirror/view')
    const parent = document.createElement('div')
    document.body.append(parent)
    const settings = { language: 'json', placeholder: 'Type', showLineNumbers: true, wrap: false, readonly: false, disabled: false, label: 'Config', invalid: true, errorAt: 1 } as const
    const handle = mountCodeEditor(parent, '{,}', settings, () => {})
    const view = EditorView.findFromDOM(parent.querySelector<HTMLElement>('.cm-editor')!)!
    const dispatch = vi.spyOn(view, 'dispatch')
    try {
      handle.configure({ ...settings })
      expect(dispatch).not.toHaveBeenCalled()
      handle.configure({ ...settings, errorAt: 2 })
      expect(dispatch).toHaveBeenCalledTimes(1)
      expect((dispatch.mock.calls[0]![0] as { effects: unknown[] }).effects).toHaveLength(1)
      expect(parent.querySelector('.lumi-code-error-mark')?.textContent).toBe('}')
      handle.configure({ ...settings, errorAt: 2, placeholder: 'Paste JSON', wrap: true })
      expect((dispatch.mock.calls[1]![0] as { effects: unknown[] }).effects).toHaveLength(2)
    }
    finally {
      handle.destroy()
      parent.remove()
    }
  })

  it('loads a non-JSON language chunk and switches it in', async () => {
    const { loadEditorLanguage, mountCodeEditor } = await import('../src/code/editor.js')
    const { syntaxTree } = await import('@codemirror/language')
    const { EditorView } = await import('@codemirror/view')
    const parent = document.createElement('div')
    document.body.append(parent)
    const settings = { language: 'go', placeholder: '', showLineNumbers: false, wrap: false, readonly: false, disabled: false, label: 'Go', invalid: false, errorAt: null } as const
    const handle = mountCodeEditor(parent, 'package main', settings, () => {})
    try {
      await loadEditorLanguage('go')
      await settle()
      const view = EditorView.findFromDOM(parent.querySelector<HTMLElement>('.cm-editor')!)!
      expect(syntaxTree(view.state).topNode.name).toBe('SourceFile')
      // The Go chunk also carries the highlighter's grammar.
      expect(codeGrammar('go')).toBeDefined()
    }
    finally {
      handle.destroy()
      parent.remove()
    }
  })
})
