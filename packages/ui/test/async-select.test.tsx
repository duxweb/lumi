// @vitest-environment jsdom
import type { ReactNode } from 'react'
import type { Option } from '../src/catalog/types-public.js'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { LumiAutoComplete, matchOptions } from '../src/components/autocomplete.js'
import { LumiMultiSelect, LumiSelect } from '../src/components/controls.js'
import { findMention, LumiMention } from '../src/components/mention.js'
import { LumiTransfer } from '../src/components/transfer.js'

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

async function mount(element: ReactNode): Promise<{ host: HTMLElement, rerender: (next: ReactNode) => Promise<void> }> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  await act(async () => root.render(element))
  return { host, rerender: next => act(async () => root.render(next)) }
}

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  document.body.innerHTML = ''
})

function type(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  return act(async () => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value)
    element.setSelectionRange(value.length, value.length)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function key(element: Element, name: string, init: KeyboardEventInit = {}): Promise<void> {
  return act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }))
  })
}

const optionTexts = (): string[] => Array.from(document.querySelectorAll('[role="option"]'), node => node.textContent ?? '')

const people: Option[] = [
  { label: 'Ada Chen', value: 1, description: 'Operations lead', avatar: '' },
  { label: 'Mina Lopez', value: 2, description: 'Support agent', avatar: '' },
  { label: 'Sam Okafor', value: 3, description: 'Warehouse manager', disabled: true },
]

describe('select with remote pages', () => {
  it('echoes a preselected option that is not loaded, and shows it first', async () => {
    const { host } = await mount(
      <LumiSelect ariaLabel="Owner" value={60} options={people} selectedOptions={[{ label: 'Maya Novak', value: 60 }]} hasMore onLoadMore={() => {}} onSearch={() => {}} />,
    )
    expect(host.querySelector('[role="combobox"]')?.textContent).toContain('Maya Novak')
    await act(async () => host.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
    expect(optionTexts()[0]).toContain('Maya Novak')
    expect(optionTexts().filter(text => text.includes('Maya Novak'))).toHaveLength(1)
  })

  it('asks once per loaded length for the next page while the list ends in view', async () => {
    let requests = 0
    const more = (): void => {
      requests += 1
    }
    const { rerender } = await mount(<LumiSelect ariaLabel="Owner" options={people.slice(0, 1)} hasMore onLoadMore={more} />)
    await act(async () => document.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
    expect(document.querySelector('.lumi-select-more')?.textContent).toContain('Loading more')
    expect(requests).toBe(1)
    await key(document.querySelector('[role="listbox"]')!, 'ArrowDown')
    expect(requests).toBe(1)
    await rerender(<LumiSelect ariaLabel="Owner" options={people.slice(0, 2)} hasMore onLoadMore={more} />)
    expect(requests).toBe(2)
    await rerender(<LumiSelect ariaLabel="Owner" options={people} hasMore={false} onLoadMore={more} />)
    expect(document.querySelector('.lumi-select-more')).toBeNull()
    expect(requests).toBe(2)
  })

  it('leaves filtering to the server, renders rich rows and highlights the query', async () => {
    const searches: string[] = []
    await mount(<LumiMultiSelect ariaLabel="Team" filterable options={people} onSearch={query => searches.push(query)} />)
    await act(async () => document.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
    await type(document.querySelector<HTMLInputElement>('input[aria-label="Team search"]')!, 'mi')
    expect(searches).toEqual(['mi'])
    expect(optionTexts()).toHaveLength(3)
    expect(document.querySelectorAll('[data-slot="option-media"][data-kind="avatar"]')).toHaveLength(2)
    expect(document.querySelector('[role="option"] small')?.textContent).toBe('Operations lead')
    expect(Array.from(document.querySelectorAll('mark[data-slot="option-match"]'), node => node.textContent)).toEqual(['Mi'])
  })

  it('says when a search finds nothing', async () => {
    await mount(<LumiSelect ariaLabel="Owner" filterable options={[]} onSearch={() => {}} />)
    await act(async () => document.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
    await type(document.querySelector<HTMLInputElement>('input[aria-label="Owner search"]')!, 'zz')
    expect(document.querySelector('.lumi-select-popover')?.textContent).toContain('No results for “zz”')
  })

  it('clears the panel search on the first Escape and closes on the second', async () => {
    const searches: string[] = []
    await mount(<LumiSelect ariaLabel="Owner" filterable options={people} onSearch={query => searches.push(query)} />)
    await act(async () => document.querySelector<HTMLButtonElement>('[role="combobox"]')!.click())
    const search = document.querySelector<HTMLInputElement>('input[aria-label="Owner search"]')!
    expect(search.closest('[data-slot="panel-search"]')).not.toBeNull()
    await type(search, 'ad')
    await act(async () => document.querySelector<HTMLButtonElement>('[data-slot="panel-search"] button[aria-label="Clear"]')!.click())
    expect(search.value).toBe('')
    await type(search, 'mi')
    await key(search, 'Escape')
    expect(search.value).toBe('')
    expect(searches.at(-1)).toBe('')
    expect(document.querySelector('.lumi-select-popover')).not.toBeNull()
    await key(search, 'Escape')
    expect(document.querySelector('.lumi-select-popover')).toBeNull()
  })
})

describe('autoComplete', () => {
  it('matches labels locally and keeps free text', () => {
    expect(matchOptions(people, 'lo', false).map(option => option.label)).toEqual(['Mina Lopez'])
    expect(matchOptions(people, 'lo', true)).toHaveLength(3)
  })

  it('suggests while typing, moves with arrows and takes a suggestion with Enter', async () => {
    const values: string[] = []
    const picked: Option[] = []
    const { host } = await mount(<LumiAutoComplete ariaLabel="Contact" options={people} onChange={value => values.push(value)} onSelect={option => picked.push(option)} />)
    const input = host.querySelector<HTMLInputElement>('input[role="combobox"]')!
    await type(input, 'a')
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(optionTexts()).toHaveLength(3)
    expect(optionTexts()[2]).toContain('Sam Okafor')
    await key(input, 'ArrowDown')
    await key(input, 'ArrowDown')
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent).toContain('Mina Lopez')
    await key(input, 'ArrowDown')
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent).toContain('Ada Chen')
    await key(input, 'Enter')
    expect(picked.map(option => option.value)).toEqual([1])
    expect(values.at(-1)).toBe('Ada Chen')
    expect(input.getAttribute('aria-expanded')).toBe('false')

    await type(input, 'Someone new')
    await key(input, 'Escape')
    expect(values.at(-1)).toBe('Someone new')
    expect(input.getAttribute('aria-expanded')).toBe('false')
  })

  it('reports remote searches and shows a searching row', async () => {
    const searches: string[] = []
    const { host } = await mount(<LumiAutoComplete ariaLabel="Contact" options={[]} loading onSearch={query => searches.push(query)} />)
    await type(host.querySelector<HTMLInputElement>('input')!, 'ad')
    expect(searches).toEqual(['ad'])
    expect(document.querySelector('.lumi-select-popover [role="status"]')?.textContent).toContain('Searching')
  })
})

describe('mention', () => {
  it('finds the mention being typed at the caret', () => {
    expect(findMention('Ping @mi', 8, '@')).toEqual({ start: 5, query: 'mi' })
    expect(findMention('Ping @mi there', 14, '@')).toBeNull()
    expect(findMention('mail me@example', 15, '@')).toBeNull()
    expect(findMention('#ta', 3, '#')).toEqual({ start: 0, query: 'ta' })
  })

  it('opens on the trigger and inserts the chosen label', async () => {
    const values: string[] = []
    const searches: string[] = []
    const { host } = await mount(<LumiMention ariaLabel="Note" options={people} onSearch={query => searches.push(query)} onChange={value => values.push(value)} />)
    const area = host.querySelector('textarea')!
    await act(async () => area.focus())
    await type(area, 'Ping @mi')
    expect(searches.at(-1)).toBe('mi')
    expect(area.getAttribute('aria-controls')).toBeTruthy()
    await key(area, 'ArrowDown')
    await key(area, 'ArrowDown')
    await key(area, 'Tab')
    expect(values.at(-1)).toBe('Ping @Mina Lopez ')
    expect(area.getAttribute('aria-controls')).toBeNull()
  })

  it('stays closed after Escape until a new trigger is typed', async () => {
    const { host } = await mount(<LumiMention ariaLabel="Note" options={people} />)
    const area = host.querySelector('textarea')!
    await act(async () => area.focus())
    await type(area, '@a')
    expect(area.getAttribute('aria-controls')).toBeTruthy()
    await key(area, 'Escape')
    expect(area.getAttribute('aria-controls')).toBeNull()
    await type(area, '@ad')
    expect(area.getAttribute('aria-controls')).toBeNull()
    await type(area, '@ad @')
    expect(area.getAttribute('aria-controls')).toBeTruthy()
  })

  it('leaves the Enter that confirms an input method candidate to the input method', async () => {
    const values: string[] = []
    const { host } = await mount(<LumiMention ariaLabel="Note" options={people} onChange={value => values.push(value)} />)
    const area = host.querySelector('textarea')!
    await act(async () => area.focus())
    await type(area, '@m')
    // Safari ends composition with keyCode 229 and isComposing already false.
    await key(area, 'Enter', { keyCode: 229 })
    expect(values.at(-1)).toBe('@m')
    expect(area.getAttribute('aria-controls')).toBeTruthy()
  })
})

describe('transfer', () => {
  const channels: Option[] = [
    { label: 'Email', value: 'email' },
    { label: 'SMS', value: 'sms' },
    { label: 'Push', value: 'push' },
    { label: 'Phone', value: 'phone', disabled: true },
  ]
  const list = (side: 'source' | 'target') => document.querySelector(`[data-slot="transfer-list"][data-side="${side}"]`)!
  const rows = (side: 'source' | 'target') => Array.from(list(side).querySelectorAll('[role="option"]'), node => node.textContent)

  it('moves checked items across and back', async () => {
    const values: unknown[] = []
    const { host } = await mount(<LumiTransfer ariaLabel="Channels" options={channels} defaultValue={['email']} sourceTitle="Available" targetTitle="Enabled" onChange={next => values.push(next)} />)
    expect(rows('source')).toEqual(['SMS', 'Push', 'Phone'])
    expect(rows('target')).toEqual(['Email'])
    const toTarget = host.querySelector<HTMLButtonElement>('button[aria-label="Move checked to Enabled"]')!
    expect(toTarget.disabled).toBe(true)
    await act(async () => list('source').querySelector<HTMLElement>('[role="option"]')!.click())
    expect(list('source').querySelector('[data-slot="transfer-count"]')?.textContent).toBe('1/3')
    await act(async () => toTarget.click())
    expect(values.at(-1)).toEqual(['email', 'sms'])
    expect(rows('target')).toEqual(['Email', 'SMS'])

    await act(async () => list('target').querySelector<HTMLElement>('[role="option"]')!.click())
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Move checked to Available"]')!.click())
    expect(values.at(-1)).toEqual(['sms'])
  })

  it('checks all enabled rows, searches each list and toggles with the keyboard', async () => {
    const values: unknown[] = []
    const { host } = await mount(<LumiTransfer ariaLabel="Channels" options={channels} sourceTitle="Available" targetTitle="Enabled" onChange={next => values.push(next)} />)
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Check all in Available"]')!.click())
    expect(list('source').querySelector('[data-slot="transfer-count"]')?.textContent).toBe('3/4')
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Move checked to Enabled"]')!.click())
    expect(values.at(-1)).toEqual(['email', 'sms', 'push'])
    expect(rows('source')).toEqual(['Phone'])

    await type(host.querySelector<HTMLInputElement>('input[aria-label="Search Enabled"]')!, 'us')
    expect(rows('target')).toEqual(['Push'])
    const target = list('target').querySelector<HTMLElement>('[role="listbox"]')!
    await key(target, ' ')
    expect(target.querySelector('[role="option"]')?.getAttribute('aria-selected')).toBe('true')
  })

  it('moves the highlight from the search row and clears it with Escape', async () => {
    const { host } = await mount(<LumiTransfer ariaLabel="Channels" options={channels} sourceTitle="Available" targetTitle="Enabled" />)
    const search = host.querySelector<HTMLInputElement>('input[aria-label="Search Available"]')!
    const source = list('source').querySelector<HTMLElement>('[role="listbox"]')!
    expect(search.getAttribute('aria-controls')).toBe(source.id)
    await key(search, 'ArrowDown')
    await key(search, 'Enter')
    const second = source.querySelectorAll('[role="option"]')[1]!
    expect(second.getAttribute('aria-selected')).toBe('true')
    expect(search.getAttribute('aria-activedescendant')).toBe(second.id)
    expect(second.querySelector('.lumi-tree__check')?.getAttribute('data-state')).toBe('checked')
    // Options carry no focusable content of their own, and the listbox holds nothing but options.
    expect(source.querySelectorAll('button, [tabindex]')).toHaveLength(0)
    expect(Array.from(source.children).every(child => child.getAttribute('role') === 'option')).toBe(true)
    await type(search, 'zz')
    expect(rows('source')).toEqual([])
    await key(search, 'Escape')
    expect(search.value).toBe('')
    expect(rows('source')).toHaveLength(4)
  })

  it('counts a partly loaded remote source by its total and asks for more', async () => {
    let requests = 0
    const more = (): void => {
      requests += 1
    }
    await mount(<LumiTransfer ariaLabel="Crew" options={channels.slice(0, 3)} value={['email', 'other']} selectedOptions={[{ label: 'Other', value: 'other' }]} total={40} hasMore onLoadMore={more} onSearch={() => {}} />)
    expect(list('source').querySelector('[data-slot="transfer-count"]')?.textContent).toBe('38 items')
    expect(rows('target')).toEqual(['Email', 'Other'])
    expect(list('source').querySelector('.lumi-select-more')).not.toBeNull()
    expect(list('source').querySelector('[role="listbox"] [role="status"]')).toBeNull()
    expect(requests).toBeGreaterThan(0)
  })
})
