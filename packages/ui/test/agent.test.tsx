// @vitest-environment jsdom
import type { Spec } from '@json-render/core'
import type { ReactNode } from 'react'
import type { AgentMessage } from '../src/catalog/types-public.js'
import { createStateStore } from '@json-render/core'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agentDefinitions, agentMessagePartSchema, agentMessageSchema, uiComponentDefinitions } from '../src/catalog/index.js'
import { collapseDiff, diffLines } from '../src/components/agent/diff.js'
import {
  LumiAgentMentionPicker,
  LumiAgentPlan,
  LumiAgentQuestion,
  LumiAgentSessionList,
  LumiApproval,
  LumiChangeDiff,
  LumiChatMessage,
  LumiChatThread,
  LumiContextChips,
  LumiMarkdown,
  LumiMessageActions,
  LumiPromptInput,
  LumiThinking,
  LumiToolCall,
  uiRegistry,
} from '../src/react/index.js'

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

async function mount(element: ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  await act(async () => root.render(element))
  return host
}

async function rerender(host: HTMLElement, element: ReactNode): Promise<void> {
  const entry = roots.find(item => item.host === host)!
  await act(async () => entry.root.render(element))
}

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  vi.useRealTimers()
})

function press(target: Element | null | undefined): Promise<void> {
  return act(async () => (target as HTMLElement).click())
}

function typeInto(area: HTMLTextAreaElement, value: string): Promise<void> {
  return act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    setter.call(area, value)
    area.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function keydown(target: Element, init: KeyboardEventInit): Promise<void> {
  return act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
  })
}

function button(host: ParentNode, name: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(item => item.getAttribute('aria-label') === name || item.textContent?.trim() === name)
}

const answer: AgentMessage = {
  id: 'a1',
  role: 'assistant',
  parts: [
    { type: 'reasoning', state: 'done', duration: 4200, steps: [{ label: 'Read order stats' }, { label: 'Checked payments', detail: '41 failed' }] },
    { type: 'tool-call', toolCallId: 'c1', toolName: 'payments.logs', title: 'Search payment logs', status: 'success', duration: 820, input: { date: '2026-08-01' }, output: { failed: 41 } },
    { type: 'text', text: 'Revenue fell **88%** because payments failed [1].' },
    { type: 'approval', id: 'remind', title: 'Send reminders', action: 'orders.remind', status: 'pending', items: [{ id: 'A', label: 'ORD-1' }, { id: 'B', label: 'ORD-2', selected: false }] },
    { type: 'plan', steps: [{ id: 'one', label: 'Read', status: 'done' }, { id: 'two', label: 'Write', status: 'running' }] },
    { type: 'diff', title: 'ORD-1', fields: [{ label: 'Shipping', before: 'Standard', after: 'Express' }] },
    { type: 'source', sourceId: 'log', title: 'Payment log', snippet: '41 callbacks failed.' },
    { type: 'file', mediaType: 'text/csv', filename: 'report.csv', size: 2048 },
  ],
  suggestions: [{ label: 'Retry payments' }],
}

describe('agent message contract', () => {
  it('parses every part type and rejects unknown ones', () => {
    expect(agentMessageSchema.parse(answer)).toEqual(answer)
    expect(agentMessagePartSchema.safeParse({ type: 'context', items: [{ id: 'p', label: 'Orders', kind: 'page' }] }).success).toBe(true)
    expect(agentMessagePartSchema.safeParse({ type: 'html', html: '<b>x</b>' }).success).toBe(false)
    expect(agentMessagePartSchema.safeParse({ type: 'tool-call', toolCallId: 'x', toolName: 'y', status: 'done' }).success).toBe(false)
    expect(agentMessageSchema.safeParse({ ...answer, extra: true }).success).toBe(false)
  })

  it('registers each component in the UI Catalog with serializable props', () => {
    for (const name of Object.keys(agentDefinitions))
      expect(uiComponentDefinitions).toHaveProperty(name)
    expect(uiComponentDefinitions.ChatThread.props.safeParse({ messages: [answer], streaming: true }).success).toBe(true)
    expect(uiComponentDefinitions.Approval.props.safeParse({ title: 'Delete', status: 'pending', tone: 'danger' }).success).toBe(true)
    expect(uiComponentDefinitions.ToolCall.props.safeParse({ toolName: 'x', status: 'queued' }).success).toBe(false)
    expect(uiRegistry).toHaveProperty('ChatThread')
  })
})

describe('markdown', () => {
  it('renders the supported blocks and inline marks', async () => {
    const host = await mount(<LumiMarkdown text={'## Totals\n\nPaid **$562** with _care_ and `code` ~~old~~.\n\n- one\n- two\n  - nested\n\n1. first\n2. second\n\n> quoted\n\n| Day | Revenue |\n| --- | ---: |\n| 08/01 | $562 |\n\n```json\n{"a":1}\n```'} />)
    expect(host.querySelector('h2')?.textContent).toBe('Totals')
    expect(host.querySelector('strong')?.textContent).toBe('$562')
    expect(host.querySelector('em')?.textContent).toBe('care')
    expect(host.querySelector('del')?.textContent).toBe('old')
    expect(host.querySelector('[data-slot="markdown-code"]')?.textContent).toBe('code')
    expect(host.querySelectorAll('ul > li')).toHaveLength(3)
    expect(host.querySelector('ul ul li')?.textContent).toBe('nested')
    expect(host.querySelectorAll('ol > li')).toHaveLength(2)
    expect(host.querySelector('blockquote')?.textContent).toBe('quoted')
    expect(host.querySelector('td:last-child')?.getAttribute('style')).toContain('right')
    expect(host.querySelector('[data-slot="code-block"]')?.textContent).toContain('"a":1')
  })

  it('never interprets HTML and only links safe URLs', async () => {
    const host = await mount(<LumiMarkdown text="<script>alert(1)</script> <img src=x onerror=alert(1)> [bad](javascript:alert(1)) [ok](https://example.com) [rel](/orders/1)" />)
    expect(host.querySelector('script, img')).toBeNull()
    expect(host.textContent).toContain('<script>alert(1)</script>')
    const links = Array.from(host.querySelectorAll('a'))
    expect(links.map(link => link.getAttribute('href'))).toEqual(['https://example.com', '/orders/1'])
    expect(links[0]!.getAttribute('rel')).toBe('noopener noreferrer')
    expect(host.textContent).toContain('bad')
  })

  it('leaves unclosed marks as text while streaming and renders citations on request', async () => {
    const host = await mount(<LumiMarkdown text="Revenue **fell [1] and [9]" renderCitation={index => (index === 1 ? <sup data-cite="">1</sup> : undefined)} trailing={<span data-caret="" />} />)
    expect(host.querySelector('strong')).toBeNull()
    expect(host.textContent).toContain('**fell')
    expect(host.querySelectorAll('[data-cite]')).toHaveLength(1)
    expect(host.textContent).toContain('[9]')
    expect(host.querySelector('p > [data-caret]')).not.toBeNull()
  })
})

describe('chat message', () => {
  it('renders each assistant part, its sources, actions and follow-ups', async () => {
    const onSuggestion = vi.fn()
    const host = await mount(<LumiChatMessage {...answer} onSuggestion={onSuggestion} onFeedback={() => {}} onRegenerate={() => {}} />)
    // Reasoning and the tool call gather under one settled, folded activity line.
    const activity = host.querySelector('[data-slot="agent-activity"]')!
    expect(activity.getAttribute('data-state')).toBe('done')
    expect(host.querySelectorAll('[data-slot="agent-activity"]')).toHaveLength(1)
    // The round pill: status and the time the parts took; what was done is its tooltip.
    const head = activity.querySelector('[data-slot="activity-toggle"]')!
    expect(head.querySelector('.lumi-agent-activity-label')?.textContent).toBe('Done')
    expect(head.querySelector('.lumi-agent-activity-time')?.textContent).toBe('5s')
    expect(head.querySelector('.lumi-agent-activity-detail')).toBeNull()
    expect(head.getAttribute('title')).toBe('Used 1 tool')
    expect(activity.querySelector<HTMLElement>('[data-slot="activity-panel"]')!.hidden).toBe(true)
    expect(host.querySelector('[data-slot="tool-call"]')?.getAttribute('data-status')).toBe('success')
    expect(host.querySelector('[data-slot="tool-call"]')?.hasAttribute('toolcallid')).toBe(false)
    expect(host.querySelector('[data-slot="markdown"] strong')?.textContent).toBe('88%')
    expect(host.querySelector('[data-slot="approval"]')).not.toBeNull()
    expect(host.querySelector('[data-slot="agent-plan"]')).not.toBeNull()
    expect(host.querySelector('[data-slot="change-diff"] del')?.textContent).toBe('Standard')
    expect(host.querySelector('[data-slot="file-chip"]')?.textContent).toContain('report.csv')
    // The citation marker and the source chip both name the source.
    expect(host.querySelector('[data-slot="source-chip"][data-inline]')?.getAttribute('aria-label')).toBe('Source 1: Payment log')
    expect(host.querySelector('ul[aria-label="Sources"] [data-slot="source-chip"]')?.textContent).toContain('Payment log')
    expect(host.querySelector('[role="toolbar"][aria-label="Message actions"]')).not.toBeNull()
    await press(button(host, 'Retry payments'))
    expect(onSuggestion).toHaveBeenCalledWith({ label: 'Retry payments' }, 'a1')
  })

  it('folds sources into one counted line that opens to the list', async () => {
    const host = await mount(<LumiChatMessage {...answer} />)
    const toggle = host.querySelector<HTMLButtonElement>('.lumi-agent-sources-toggle')!
    expect(toggle.textContent).toContain('1 source')
    expect(host.querySelector<HTMLElement>('ul[aria-label="Sources"]')!.hidden).toBe(true)
    await press(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector<HTMLElement>('ul[aria-label="Sources"]')!.hidden).toBe(false)
  })

  it('offers copy and edit on a user message', async () => {
    const onEditMessage = vi.fn()
    const host = await mount(<LumiChatMessage id="u1" role="user" parts={[{ type: 'text', text: 'Refund ORD-1' }]} onEditMessage={onEditMessage} />)
    expect(host.querySelector('[data-slot="user-actions"]')).not.toBeNull()
    await press(button(host, 'Edit message'))
    expect(onEditMessage).toHaveBeenCalledWith('u1', 'Refund ORD-1')
  })

  it('shows a caret while streaming and holds the actions until done', async () => {
    const message: AgentMessage = { id: 's', role: 'assistant', status: 'streaming', parts: [{ type: 'text', text: 'Working on', state: 'streaming' }], suggestions: [{ label: 'Later' }] }
    const host = await mount(<LumiChatMessage {...message} />)
    expect(host.querySelector('.lumi-agent-caret')).not.toBeNull()
    expect(host.querySelector('[role="toolbar"]')).toBeNull()
    expect(button(host, 'Later')).toBeUndefined()
    await rerender(host, <LumiChatMessage {...message} parts={[{ type: 'text', text: 'Working on it.' }]} status="done" />)
    expect(host.querySelector('.lumi-agent-caret')).toBeNull()
    expect(host.querySelector('[role="toolbar"]')).not.toBeNull()
  })

  it('shows a waiting pill before the first part and a retry when the turn failed', async () => {
    const onRegenerate = vi.fn()
    const waiting = await mount(<LumiChatMessage id="w" role="assistant" status="streaming" parts={[]} />)
    expect(waiting.querySelector('[data-slot="thinking"]')?.textContent).toContain('Working')
    const failed = await mount(<LumiChatMessage id="e" role="assistant" status="error" errorText="Connection lost." parts={[]} onRegenerate={onRegenerate} />)
    expect(failed.querySelector('[role="alert"]')?.textContent).toContain('Connection lost.')
    await press(button(failed, 'Try again'))
    expect(onRegenerate).toHaveBeenCalledWith('e')
  })

  it('draws a user message as a bubble with its context and files', async () => {
    const host = await mount(<LumiChatMessage id="u" role="user" parts={[{ type: 'context', items: [{ id: 'o', label: 'Order · 1', kind: 'record' }] }, { type: 'text', text: 'Line one\nLine two **not bold**' }]} />)
    expect(host.querySelector('[data-role="user"] .lumi-agent-bubble')?.textContent).toBe('Line one\nLine two **not bold**')
    expect(host.querySelector('[data-slot="context-chip"]')?.textContent).toContain('Order · 1')
  })

  it('reports copy, regenerate and a toggling rating', async () => {
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    const onFeedbackChange = vi.fn()
    const onRegenerate = vi.fn()
    const host = await mount(<LumiMessageActions text="Answer" feedback="up" onFeedbackChange={onFeedbackChange} onRegenerate={onRegenerate} />)
    await press(button(host, 'Copy'))
    expect(writeText).toHaveBeenCalledWith('Answer')
    expect(button(host, 'Copied')).toBeDefined()
    await press(button(host, 'Regenerate'))
    expect(onRegenerate).toHaveBeenCalled()
    expect(button(host, 'Good response')?.getAttribute('aria-pressed')).toBe('true')
    await press(button(host, 'Good response'))
    expect(onFeedbackChange).toHaveBeenLastCalledWith(null)
    await press(button(host, 'Bad response'))
    expect(onFeedbackChange).toHaveBeenLastCalledWith('down')
  })
})

describe('prompt input', () => {
  it('sends on Enter, adds a line on Shift+Enter and ignores Enter that ends a composition', async () => {
    const onSubmit = vi.fn()
    const host = await mount(<LumiPromptInput onSubmit={onSubmit} />)
    const area = host.querySelector('textarea')!
    expect(button(host, 'Send')?.disabled).toBe(true)
    await typeInto(area, '  Hello  ')
    await keydown(area, { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
    await keydown(area, { key: 'Enter', isComposing: true })
    expect(onSubmit).not.toHaveBeenCalled()
    await keydown(area, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('Hello')
  })

  it('turns send into stop while streaming', async () => {
    const onStop = vi.fn()
    const onSubmit = vi.fn()
    const host = await mount(<LumiPromptInput value="Next" streaming onStop={onStop} onSubmit={onSubmit} />)
    expect(button(host, 'Send')).toBeUndefined()
    await press(button(host, 'Stop generating'))
    expect(onStop).toHaveBeenCalled()
    await keydown(host.querySelector('textarea')!, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('removes attachment and context chips, picks a model and fills a suggestion', async () => {
    const onAttachmentsChange = vi.fn()
    const onContextChange = vi.fn()
    const host = await mount(
      <LumiPromptInput
        attachments={[{ id: 'f', name: 'report.csv', size: 2048 }, { id: 'g', name: 'up.png', status: 'uploading' }]}
        context={[{ id: 'p', label: 'Orders', kind: 'page' }]}
        onAttachmentsChange={onAttachmentsChange}
        onContextChange={onContextChange}
        suggestions={[{ label: 'Weekly report', prompt: 'Draft the weekly report' }]}
        onAttach={() => {}}
        onMention={() => {}}
      />,
    )
    expect(host.querySelector('[data-slot="attachment-chip"]')?.textContent).toContain('2 KB')
    await press(button(host, 'Remove report.csv'))
    expect(onAttachmentsChange).toHaveBeenCalledWith([{ id: 'g', name: 'up.png', status: 'uploading' }])
    await press(button(host, 'Remove Orders'))
    expect(onContextChange).toHaveBeenCalledWith([])
    expect(host.querySelector('input[type="file"]')).not.toBeNull()
    expect(button(host, 'Reference a page or record')).toBeDefined()
    await press(button(host, 'Weekly report'))
    expect(host.querySelector('textarea')!.value).toBe('Draft the weekly report')
    expect(button(host, 'Weekly report')).toBeUndefined()
  })

  it('switches the approval mode between asking every time and full access', async () => {
    const onApprovalModeChange = vi.fn()
    const host = await mount(<LumiPromptInput approvalMode="ask" onApprovalModeChange={onApprovalModeChange} />)
    const trigger = host.querySelector<HTMLButtonElement>('[data-slot="prompt-approval-mode"]')!
    expect(trigger.getAttribute('aria-label')).toBe('Permissions: Ask every time')
    expect(trigger.dataset.mode).toBe('ask')
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
    expect(items.map(item => item.textContent)).toEqual(['Ask every timeChanges wait for your approval', 'Full accessThe agent acts without asking'])
    expect(items[0]!.getAttribute('aria-checked')).toBe('true')
    await press(items[1]!)
    expect(onApprovalModeChange).toHaveBeenCalledWith('auto')
    // Without a mode the picker is absent.
    const plain = await mount(<LumiPromptInput />)
    expect(plain.querySelector('[data-slot="prompt-approval-mode"]')).toBeNull()
  })

  function typeChar(area: HTMLTextAreaElement, value: string, data: string): Promise<void> {
    return act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, value)
      area.setSelectionRange(value.length, value.length)
      area.dispatchEvent(new InputEvent('input', { bubbles: true, data, inputType: 'insertText' }))
    })
  }

  it('opens the @ picker from an @ at a word start, and a pick replaces the @ with a context chip', async () => {
    const onContextChange = vi.fn()
    const mentions = { types: [{ value: 'orders', label: 'Orders' }], options: [{ value: 7, label: 'ORD-7', description: 'Avery' }] }
    const host = await mount(<LumiPromptInput mentions={mentions} context={[]} onContextChange={onContextChange} />)
    const area = host.querySelector('textarea')!
    // An @ inside a word, such as an address, is only text.
    await typeChar(area, 'a@', '@')
    expect(document.querySelector('[data-slot="prompt-mention"]')).toBeNull()
    await typeChar(area, 'Check @', '@')
    const picker = document.querySelector('[data-slot="prompt-mention"]')!
    expect(picker).not.toBeNull()
    await press(picker.querySelector('[role="option"]'))
    expect(onContextChange).toHaveBeenCalledWith([{ id: 'orders:7', label: 'ORD-7', kind: 'record', description: 'Avery' }])
    expect(area.value).toBe('Check ')
    expect(document.querySelector('[data-slot="prompt-mention"]')).toBeNull()
    // The @ button opens it too, once the closed picker has handed focus back (Radix does that on a timer).
    await act(() => new Promise(resolve => setTimeout(resolve, 0)))
    await press(button(host, 'Reference a page or record'))
    expect(document.querySelector('[data-slot="prompt-mention"]')).not.toBeNull()
  })

  it('cycles the @ picker kinds with Tab inside the composer menu, which Escape closes', async () => {
    const mentions = { types: [{ value: 'orders', label: 'Orders' }, { value: 'customers', label: 'Customers' }], options: [{ value: 7, label: 'ORD-7', type: 'orders' }] }
    const host = await mount(<LumiPromptInput mentions={mentions} context={[]} onContextChange={() => {}} />)
    await typeChar(host.querySelector('textarea')!, '@', '@')
    const picker = document.querySelector('[data-slot="prompt-mention"]')!
    const search = picker.querySelector<HTMLInputElement>('input')!
    const selected = (): string | null | undefined => picker.querySelector('[role="tab"][aria-selected="true"]')?.textContent
    await keydown(search, { key: 'Tab' })
    expect(selected()).toBe('Customers')
    await keydown(search, { key: 'Tab', shiftKey: true })
    expect(selected()).toBe('Orders')
    await keydown(search, { key: 'Tab', shiftKey: true })
    expect(selected()).toBe('Customers')
  })

  it('offers slash commands while the box holds only the command', async () => {
    const onCommand = vi.fn()
    const commands = [
      { value: 'late', label: 'Find late orders', prompt: 'Which orders are late?' },
      { value: 'clear', label: 'Clear the conversation' },
    ]
    const host = await mount(<LumiPromptInput commands={commands} onCommand={onCommand} />)
    const area = host.querySelector('textarea')!
    await typeInto(area, '/')
    const list = (): Element | null => document.querySelector('[data-slot="prompt-commands"] [role="listbox"]')
    expect(list()?.querySelectorAll('[role="option"]')).toHaveLength(2)
    expect(area.getAttribute('aria-activedescendant')).toBe(list()!.querySelector('[role="option"]')!.id)
    await typeInto(area, '/cl')
    expect(list()?.textContent).toContain('Clear the conversation')
    await keydown(area, { key: 'Enter' })
    expect(onCommand).toHaveBeenCalledWith(commands[1])
    expect(area.value).toBe('')
    // A command with a prompt fills the box instead.
    await typeInto(area, '/')
    await keydown(area, { key: 'Enter' })
    expect(area.value).toBe('Which orders are late?')
    expect(list()).toBeNull()
    // Escape keeps the text and closes the list; text after the name is no command.
    await typeInto(area, '/la')
    await keydown(area, { key: 'Escape' })
    expect(list()).toBeNull()
    expect(area.value).toBe('/la')
    await typeInto(area, '/late now')
    expect(list()).toBeNull()
  })
})

describe('thinking', () => {
  const matchMedia = window.matchMedia
  beforeEach(() => {
    window.matchMedia = matchMedia
  })

  it('counts while working with the steps open, then settles folded with the time taken', async () => {
    vi.useFakeTimers()
    const steps = [{ label: 'Read orders' }, { label: 'Checking notes', status: 'running' as const }]
    const host = await mount(<LumiThinking state="streaming" label="Searching orders" steps={steps} />)
    await act(async () => vi.advanceTimersByTime(3200))
    const toggle = host.querySelector('[data-slot="thinking-toggle"]')!
    expect(toggle.getAttribute('title')).toBe('Searching orders')
    expect(toggle.textContent).toContain('3s')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelectorAll('[data-slot="thinking-panel"] li')).toHaveLength(2)
    await rerender(host, <LumiThinking state="done" steps={steps} duration={12_400} />)
    expect(toggle.textContent).toContain('Done')
    expect(toggle.textContent).toContain('12s')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(host.querySelector<HTMLElement>('[data-slot="thinking-panel"]')!.hidden).toBe(true)
    await press(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('marks a failed step and keeps an explicit open state', async () => {
    const host = await mount(<LumiThinking state="done" open steps={[{ label: 'Courier', status: 'error' }]} />)
    expect(host.querySelector('[data-slot="thinking"]')?.getAttribute('data-state')).toBe('error')
    expect(host.querySelector('[data-slot="thinking-panel"]')?.hasAttribute('hidden')).toBe(false)
  })

  it('stops motion for readers who prefer reduced motion', async () => {
    window.matchMedia = ((query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    const host = await mount(
      <>
        <LumiThinking state="streaming" />
        <LumiChatMessage id="m" role="assistant" status="streaming" parts={[{ type: 'text', text: 'Hi' }]} />
      </>,
    )
    expect(host.querySelector('[data-slot="thinking"]')?.getAttribute('data-motion')).toBe('reduce')
    expect(host.querySelector('.lumi-agent-caret')?.getAttribute('data-motion')).toBe('reduce')
  })
})

describe('tool call, approval, plan, diff and context', () => {
  it('folds a tool call input and output and shows its error', async () => {
    const host = await mount(<LumiToolCall toolName="customers.get" title="Read customer" status="success" duration={412} input={{ id: 7 }} output='{"name":"Avery"}' />)
    const head = host.querySelector('button[aria-expanded]')!
    expect(head.textContent).toContain('Done')
    expect(host.querySelector<HTMLElement>('[data-slot="tool-call-body"]')!.hidden).toBe(true)
    await press(head)
    // Only what the call returned is shown; the input stays in the message.
    const blocks = host.querySelectorAll('[data-slot="code-block"]')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.textContent).toContain('"name": "Avery"')
    const failed = await mount(<LumiToolCall toolName="courier.track" status="error" errorText="Timed out" defaultOpen />)
    expect(failed.querySelector('.lumi-agent-tool-error')?.textContent).toBe('Timed out')
  })

  it('narrows, approves and rejects, then keeps the decision without buttons', async () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    const items = [{ id: 'A', label: 'ORD-1' }, { id: 'B', label: 'ORD-2' }]
    const host = await mount(<LumiApproval title="Send reminders" action="orders.remind" status="pending" items={items} onApprove={onApprove} onReject={onReject} />)
    // The action names the decision for the host; the reader never sees it.
    expect(host.textContent).not.toContain('orders.remind')
    expect(button(host, 'Approve (2)')).toBeDefined()
    await press(host.querySelector('button[role="checkbox"][aria-label="ORD-1"]'))
    await press(button(host, 'Approve (1)'))
    expect(onApprove).toHaveBeenCalledWith(['B'])
    await press(host.querySelector('button[role="checkbox"][aria-label="ORD-2"]'))
    expect(button(host, 'Approve (0)')?.disabled).toBe(true)
    await press(button(host, 'Reject'))
    expect(onReject).toHaveBeenCalled()
    await rerender(host, <LumiApproval title="Send reminders" status="approved" reason="Sent 1 reminder." items={items} onApprove={onApprove} />)
    expect(button(host, 'Approve (1)')).toBeUndefined()
    expect(host.textContent).toContain('Sent 1 reminder.')
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Approved')
  })

  it('locks an approval while it runs, keeps it open with the reason when it failed, and folds a decision', async () => {
    const lines = [{ title: 'Linen shirt', description: 'Size M x1', amount: '¥299' }]
    const fields = [{ label: 'Shipping', value: 'Free', tone: 'success' as const }]
    const host = await mount(<LumiApproval title="Place order" status="running" lines={lines} fields={fields} total={{ value: '¥299' }} onApprove={() => {}} onReject={() => {}} />)
    expect(host.querySelector('.lumi-agent-line-title')?.textContent).toBe('Linen shirt')
    expect(host.querySelector('dl[data-bordered] dd[data-tone="success"]')?.textContent).toBe('Free')
    expect(host.querySelector('.lumi-agent-total')?.textContent).toContain('Total')
    expect(button(host, 'Reject')?.disabled).toBe(true)
    expect(host.querySelector('[data-slot="approval"]')?.getAttribute('aria-busy')).toBe('true')
    await rerender(host, <LumiApproval title="Place order" status="failed" reason="Out of stock" lines={lines} onApprove={() => {}} />)
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Out of stock')
    expect(button(host, 'Approve')?.disabled).toBe(false)
    await rerender(host, <LumiApproval title="Place order" status="rejected" lines={lines} />)
    const decided = host.querySelector<HTMLButtonElement>('.lumi-agent-decided')!
    expect(decided.textContent).toContain('Rejected')
    expect(host.querySelector('.lumi-agent-line')).toBeNull()
    await press(decided)
    expect(decided.getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('.lumi-agent-line')).not.toBeNull()
  })

  it('folds more than five items behind a show more button', async () => {
    const items = Array.from({ length: 7 }, (_, index) => ({ id: String(index), label: `ORD-${index}` }))
    const host = await mount(<LumiApproval title="Remind" status="pending" items={items} onApprove={() => {}} />)
    expect(host.querySelectorAll('.lumi-agent-approval-item')).toHaveLength(5)
    await press(button(host, 'Show 2 more'))
    expect(host.querySelectorAll('.lumi-agent-approval-item')).toHaveLength(7)
    expect(button(host, 'Approve (7)')).toBeDefined()
  })

  it('answers a single choice on press or by digit, then folds to the answer', async () => {
    const onAnswer = vi.fn()
    const options = [{ value: 'sf', label: 'SF Express' }, { value: 'ems', label: 'EMS' }]
    const host = await mount(<LumiAgentQuestion id="q" title="Which courier" status="pending" options={options} onAnswer={onAnswer} />)
    await press(button(host, '1SF Express'))
    expect(onAnswer).toHaveBeenLastCalledWith('sf')
    await keydown(host.querySelector('[data-slot="agent-question"]')!, { key: '2' })
    expect(onAnswer).toHaveBeenLastCalledWith('ems')
    await rerender(host, <LumiAgentQuestion id="q" title="Which courier" status="answered" answer="ems" options={options} onAnswer={onAnswer} />)
    const decided = host.querySelector('.lumi-agent-decided')!
    expect(decided.textContent).toContain('Answered')
    expect(decided.textContent).toContain('EMS')
    await press(decided)
    expect(host.querySelectorAll('.lumi-agent-option')).toHaveLength(2)
  })

  it('confirms several choices with a written one and skips', async () => {
    const onAnswer = vi.fn()
    const onSkip = vi.fn()
    const options = [{ value: 'a', label: 'Gift wrap' }, { value: 'b', label: 'Invoice' }]
    const host = await mount(<LumiAgentQuestion id="q" title="Extras" mode="multiple" allowText skippable status="pending" options={options} onAnswer={onAnswer} onSkip={onSkip} />)
    expect(button(host, 'Confirm')?.disabled).toBe(true)
    await press(host.querySelectorAll('.lumi-agent-option')[1])
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('.lumi-agent-option-text')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Card')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await press(button(host, 'Confirm'))
    expect(onAnswer).toHaveBeenCalledWith(['b', 'Card'])
    await press(button(host, 'Skip'))
    expect(onSkip).toHaveBeenCalled()
  })

  it('summarises plan progress and marks the running step', async () => {
    const host = await mount(<LumiAgentPlan steps={[{ id: 'a', label: 'One', status: 'done' }, { id: 'b', label: 'Two', status: 'skipped' }, { id: 'c', label: 'Three', status: 'running' }, { id: 'd', label: 'Four', status: 'pending' }]} />)
    expect(host.querySelector('.lumi-agent-plan-count')?.textContent).toBe('2/4')
    expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('Three')
    expect(host.querySelector('[data-status="skipped"] .lumi-agent-plan-tag')?.textContent).toBe('Skipped')
  })

  it('diffs record fields and text lines', async () => {
    const fields = await mount(<LumiChangeDiff fields={[{ label: 'Shipping', before: 'Standard', after: 'Express' }, { label: 'Note', after: 'Rush' }, { label: 'Coupon', before: 'SUMMER' }, { label: 'Gift', before: true, after: false }]} />)
    expect(Array.from(fields.querySelectorAll('[data-kind]'), row => row.getAttribute('data-kind'))).toEqual(['changed', 'added', 'removed', 'changed'])
    expect(fields.querySelector('[data-kind="changed"]:last-child ins')?.textContent).toBe('No')
    // A missing side reads as Empty, so every row is before → after.
    expect(fields.querySelector('[data-kind="added"] dd')?.textContent).toBe('Empty→changed toRush')
    expect(fields.querySelector('[data-kind="removed"] dd')?.textContent).toBe('SUMMER→changed toEmpty')
    const text = await mount(<LumiChangeDiff before={'a\nb\nc'} after={'a\nB\nc\nd'} />)
    expect(text.querySelector('.lumi-agent-diff-count')?.textContent).toBe('+2−1')
    expect(text.querySelectorAll('[data-diff="added"] ins')).toHaveLength(2)
    expect(text.querySelector('[data-diff="removed"] del')?.textContent).toBe('b')
  })

  it('computes a line diff and folds long unchanged runs', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc').map(line => `${line.kind[0]}${line.text}`)).toEqual(['sa', 'rb', 'ax', 'sc'])
    const before = Array.from({ length: 20 }, (_, index) => `line ${index}`).join('\n')
    const rows = collapseDiff(diffLines(before, before.replace('line 10', 'changed')))
    expect(rows.filter(row => row.kind === 'gap').map(row => (row as { count: number }).count)).toEqual([7, 6])
  })

  it('shares the viewed page, removes context items and warns as the window fills', async () => {
    const onSharedChange = vi.fn()
    const onRemove = vi.fn()
    const host = await mount(<LumiContextChips viewing="Order detail · 1" shared items={[{ id: 'c', label: 'Avery Chen', kind: 'record' }]} removable onSharedChange={onSharedChange} onRemove={onRemove} usage={{ used: 120_000, limit: 128_000, unit: 'tokens' }} />)
    expect(host.querySelector('[data-slot="context-viewing"]')?.textContent).toContain('Viewing')
    await press(host.querySelector('button[role="switch"]'))
    expect(onSharedChange).toHaveBeenCalledWith(false)
    await press(button(host, 'Remove Avery Chen'))
    expect(onRemove).toHaveBeenCalledWith({ id: 'c', label: 'Avery Chen', kind: 'record' })
    expect(host.querySelector('.lumi-agent-usage')?.getAttribute('data-level')).toBe('warning')
  })
})

describe('mention picker and session list', () => {
  const types = [{ value: 'orders', label: 'Orders' }, { value: 'customers', label: 'Customers', icon: 'user' }]
  const options = [
    { value: 1, label: 'ORD-00017', description: 'Chengdu', type: 'orders' },
    { value: 2, label: 'ORD-00020', description: 'Chengdu', type: 'orders' },
    { value: 1, label: 'Avery Chen', description: 'avery@example.test', type: 'customers' },
  ]

  it('filters static results by tab and search, and picks with the keyboard', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiAgentMentionPicker types={types} options={options} multiple onChange={onChange} />)
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(2)
    await press(host.querySelectorAll('[role="tab"]')[1])
    expect(host.querySelector('[role="option"]')?.textContent).toContain('Avery Chen')
    // Kinds keep the same number apart: customer 1 is not order 1.
    await press(host.querySelector('[role="option"]'))
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'customers:1', label: 'Avery Chen', kind: 'record', icon: 'user', description: 'avery@example.test' }])
    await press(host.querySelectorAll('[role="tab"]')[0])
    const search = host.querySelector<HTMLInputElement>('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, '020')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(1)
    expect(host.querySelector('[role="option"] mark')?.textContent).toBe('020')
    await keydown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'orders:2', label: 'ORD-00020' })])
  })

  it('switches kinds with Left/Right at the edge of the search and wraps Up/Down', async () => {
    const host = await mount(<LumiAgentMentionPicker types={types} options={options} />)
    const search = host.querySelector<HTMLInputElement>('input')!
    const selected = (): string | null | undefined => host.querySelector('[role="tab"][aria-selected="true"]')?.textContent
    const active = (): string | null | undefined => host.querySelector('[role="option"][data-active]')?.textContent
    await keydown(search, { key: 'ArrowUp' })
    expect(active()).toContain('ORD-00020')
    await keydown(search, { key: 'ArrowDown' })
    expect(active()).toContain('ORD-00017')
    await keydown(search, { key: 'ArrowRight' })
    expect(selected()).toBe('Customers')
    await keydown(search, { key: 'ArrowRight' })
    expect(selected()).toBe('Orders')
    await keydown(search, { key: 'ArrowLeft' })
    expect(selected()).toBe('Customers')
    // Inside typed text the arrows move the caret instead.
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'av')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    search.setSelectionRange(1, 1)
    await keydown(search, { key: 'ArrowLeft' })
    await keydown(search, { key: 'ArrowRight' })
    expect(selected()).toBe('Customers')
  })

  it('leaves Tab to move focus when standalone, so the search never traps it', async () => {
    const host = await mount(<LumiAgentMentionPicker types={types} options={options} />)
    const search = host.querySelector<HTMLInputElement>('input')!
    for (const shiftKey of [false, true]) {
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
      await act(async () => {
        search.dispatchEvent(event)
      })
      expect(event.defaultPrevented).toBe(false)
      expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Orders')
    }
  })

  it('cycles kinds with Tab and Shift+Tab, wrapping, when asked to', async () => {
    const host = await mount(<LumiAgentMentionPicker types={types} options={options} cycleTabs />)
    const search = host.querySelector<HTMLInputElement>('input')!
    const selected = (): string | null | undefined => host.querySelector('[role="tab"][aria-selected="true"]')?.textContent
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    await act(async () => {
      search.dispatchEvent(tab)
    })
    expect(tab.defaultPrevented).toBe(true)
    expect(selected()).toBe('Customers')
    await keydown(search, { key: 'Tab' })
    expect(selected()).toBe('Orders')
    await keydown(search, { key: 'Tab', shiftKey: true })
    expect(selected()).toBe('Customers')
  })

  it('shows what a remote host gives it and says when nothing matches', async () => {
    const host = await mount(<LumiAgentMentionPicker remote types={types} type="orders" query="zzz" options={[]} />)
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Nothing matches “zzz”')
  })

  it('lists sessions with a status dot, groups, search and the open one marked', async () => {
    const onChange = vi.fn()
    const sessions = [
      { id: 'a', title: 'Refunds', status: 'running' as const, group: 'Today', preview: 'Checking notes', time: '13:05' },
      { id: 'b', title: 'Sales report', group: 'Today' },
      { id: 'c', title: 'Courier timeouts', status: 'error' as const, group: 'Earlier' },
    ]
    const host = await mount(<LumiAgentSessionList sessions={sessions} value="b" variant="detailed" searchable onChange={onChange} />)
    expect(Array.from(host.querySelectorAll('.lumi-agent-sessions-group')).map(node => node.textContent)).toEqual(['Today', 'Earlier'])
    expect(host.querySelector('[aria-current="true"]')?.textContent).toContain('Sales report')
    expect(host.querySelector('[data-status="running"]')?.textContent).toContain('Working')
    expect(host.querySelector('[data-status="running"] .lumi-agent-session-preview')?.textContent).toBe('Checking notes')
    await press(button(host, 'Courier timeoutsFailed'))
    expect(onChange).toHaveBeenCalledWith('c', sessions[2])
    const search = host.querySelector<HTMLInputElement>('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'sales')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(host.querySelectorAll('.lumi-agent-session')).toHaveLength(1)
  })
})

describe('chat thread and JSON wiring', () => {
  it('shows an empty state, then messages and a waiting pill', async () => {
    const empty = await mount(<LumiChatThread messages={[]} emptyTitle="Ask anything" />)
    expect(empty.textContent).toContain('Ask anything')
    const host = await mount(<LumiChatThread messages={[{ id: 'u', role: 'user', parts: [{ type: 'text', text: 'Hi' }] }]} streaming />)
    expect(host.querySelector('ol[aria-label="Conversation"]')?.getAttribute('aria-busy')).toBe('true')
    expect(host.querySelector('li[data-waiting] [data-slot="thinking"]')).not.toBeNull()
  })

  it('offers a jump to the latest message once the reader scrolls up', async () => {
    const host = await mount(<LumiChatThread messages={[answer]} maxHeight={200} />)
    const list = host.querySelector<HTMLElement>('[data-slot="chat-thread"]')!
    expect(host.querySelector('[data-slot="jump-latest"]')).toBeNull()
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 })
    list.scrollTo = vi.fn()
    await act(async () => {
      list.scrollTop = 100
      list.dispatchEvent(new Event('scroll'))
    })
    await press(button(host, 'Jump to latest'))
    expect(list.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' })
  })

  it('keeps host children and the jump button outside the message list', async () => {
    const host = await mount(<LumiChatThread messages={[answer]} maxHeight={200}><p data-testid="footer">Footer</p></LumiChatThread>)
    const thread = host.querySelector<HTMLElement>('[data-slot="chat-thread"]')!
    const list = thread.querySelector('ol[aria-label="Conversation"]')!
    expect(thread.tagName).toBe('DIV')
    expect(Array.from(list.children).every(child => child.tagName === 'LI')).toBe(true)
    expect(host.querySelector('[data-testid="footer"]')!.parentElement).toBe(thread)
    Object.defineProperty(thread, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(thread, 'clientHeight', { configurable: true, value: 200 })
    await act(async () => {
      thread.scrollTop = 100
      thread.dispatchEvent(new Event('scroll'))
    })
    expect(host.querySelector('[data-slot="jump-latest"]')!.parentElement).toBe(thread)
    expect(Array.from(list.children).every(child => child.tagName === 'LI')).toBe(true)
  })

  it('stays at the bottom when content grows after render while the reader is there', async () => {
    const observers: Array<{ callback: ResizeObserverCallback, targets: Element[] }> = []
    const original = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      targets: Element[] = []
      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback, targets: this.targets })
      }

      observe(target: Element): void {
        this.targets.push(target)
      }

      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    try {
      const host = await mount(<LumiChatThread messages={[answer]} maxHeight={200} />)
      const thread = host.querySelector<HTMLElement>('[data-slot="chat-thread"]')!
      const list = thread.querySelector('ol')!
      const observer = observers.find(entry => entry.targets.includes(list))!
      expect(observer).toBeDefined()
      let height = 600
      Object.defineProperty(thread, 'scrollHeight', { configurable: true, get: () => height })
      Object.defineProperty(thread, 'clientHeight', { configurable: true, value: 200 })
      // A code block finishes highlighting and grows the last message.
      height = 900
      observer.callback([], {} as ResizeObserver)
      expect(thread.scrollTop).toBe(900)
      // Once the reader scrolls up, growth leaves them where they are.
      await act(async () => {
        thread.scrollTop = 100
        thread.dispatchEvent(new Event('scroll'))
      })
      height = 1200
      observer.callback([], {} as ResizeObserver)
      expect(thread.scrollTop).toBe(100)
    }
    finally {
      globalThis.ResizeObserver = original
    }
  })

  it('keeps ratings and approval decisions in bound messages and reports the event', async () => {
    const store = createStateStore({ chat: { messages: [answer], event: null } })
    const approved = vi.fn()
    const spec: Spec = {
      root: 'thread',
      elements: {
        thread: {
          type: 'ChatThread',
          props: { messages: { $bindState: '/chat/messages' }, activeEvent: { $bindState: '/chat/event' } },
          on: { approve: { action: 'approved', params: { approval: { $state: '/chat/event/partId' }, items: { $state: '/chat/event/value' } } } },
          children: [],
        },
      },
    } as Spec
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store} handlers={{ approved }}>
        <Renderer spec={spec} registry={uiRegistry} />
      </JSONUIProvider>,
    )
    await press(button(host, 'Good response'))
    expect((store.get('/chat/messages') as AgentMessage[])[0]!.feedback).toBe('up')
    expect(store.get('/chat/event')).toEqual({ type: 'feedback', messageId: 'a1', value: 'up' })
    await press(host.querySelector('button[role="checkbox"][aria-label="ORD-2"]'))
    await press(button(host, 'Approve (2)'))
    const part = (store.get('/chat/messages') as AgentMessage[])[0]!.parts.find(item => item.type === 'approval')!
    expect(part).toMatchObject({ status: 'approved', items: [{ id: 'A', selected: true }, { id: 'B', selected: true }] })
    expect(approved).toHaveBeenCalledWith({ approval: 'remind', items: ['A', 'B'] })
    expect(button(host, 'Approve (2)')).toBeUndefined()
  })

  it('submits, clears and stops a bound prompt through native actions', async () => {
    const store = createStateStore({ draft: '', sent: [], streaming: true })
    const spec: Spec = {
      root: 'prompt',
      elements: {
        prompt: {
          type: 'PromptInput',
          props: { value: { $bindState: '/draft' }, streaming: { $state: '/streaming' } },
          on: {
            submit: { action: 'pushState', params: { statePath: '/sent', value: { $state: '/draft' }, clearStatePath: '/draft' } },
            stop: { action: 'setState', params: { statePath: '/streaming', value: false } },
          },
          children: [],
        },
      },
    } as Spec
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store}>
        <Renderer spec={spec} registry={uiRegistry} />
      </JSONUIProvider>,
    )
    await press(button(host, 'Stop generating'))
    expect(store.get('/streaming')).toBe(false)
    await typeInto(host.querySelector('textarea')!, 'Ship it')
    expect(store.get('/draft')).toBe('Ship it')
    await keydown(host.querySelector('textarea')!, { key: 'Enter' })
    expect(store.get('/sent')).toEqual(['Ship it'])
    expect(store.get('/draft')).toBe('')
  })

  it('writes a bound approval status and keeps an unbound one locally', async () => {
    const store = createStateStore({ status: 'pending' })
    const spec: Spec = {
      root: 'stack',
      elements: {
        stack: { type: 'Stack', props: {}, children: ['bound', 'local'] },
        bound: { type: 'Approval', props: { title: 'Bound', status: { $bindState: '/status' } }, children: [] },
        local: { type: 'Approval', props: { title: 'Local', status: 'pending', tone: 'danger' }, children: [] },
      },
    } as Spec
    const host = await mount(
      <JSONUIProvider registry={uiRegistry} store={store}>
        <Renderer spec={spec} registry={uiRegistry} />
      </JSONUIProvider>,
    )
    const [bound, local] = Array.from(host.querySelectorAll('[data-slot="approval"]'))
    await press(button(bound!, 'Reject'))
    expect(store.get('/status')).toBe('rejected')
    await press(button(local!, 'Approve'))
    expect(local!.getAttribute('data-status')).toBe('approved')
  })
})
