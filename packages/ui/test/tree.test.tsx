// @vitest-environment jsdom
import type { ReactNode } from 'react'
import type { CascaderOption, OptionValue } from '../src/catalog/types-public.js'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkedLeafKeys, checkedValues, filterTree, treeCheckStates, treeGuides } from '../src/components/tree-utils.js'
import { LumiCascader, LumiCascaderPanel, LumiTree, LumiTreeSelect } from '../src/react/index.js'

const roots: Array<{ root: ReturnType<typeof createRoot>, host: HTMLElement }> = []

async function mount(element: ReactNode): Promise<HTMLElement> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push({ root, host })
  await act(async () => root.render(element))
  return host
}

afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
  document.body.innerHTML = ''
})

const nodes: CascaderOption[] = [
  { value: 'design', label: 'Design', children: [
    { value: 'brand', label: 'Brand' },
    { value: 'ui', label: 'Product UI', children: [{ value: 'components', label: 'Components' }, { value: 'icons', label: 'Icons' }] },
  ] },
  { value: 'eng', label: 'Engineering', children: [{ value: 'api', label: 'API' }, { value: 'web', label: 'Frontend', disabled: true }] },
]

function item(host: ParentNode, label: string): HTMLElement {
  const found = [...host.querySelectorAll<HTMLElement>('[role=treeitem]')].find(element => element.querySelector('.lumi-tree__label')?.textContent === label)
  if (!found)
    throw new Error(`No tree item ${label}`)
  return found
}

function visible(host: ParentNode): string[] {
  return [...host.querySelectorAll<HTMLElement>('[role=treeitem]')]
    .filter(element => !element.closest('[inert]'))
    .map(element => element.querySelector('.lumi-tree__label')!.textContent!)
}

async function click(element: Element): Promise<void> {
  await act(async () => (element as HTMLElement).click())
}

async function key(element: Element, name: string): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  })
}

async function type(input: HTMLInputElement, text: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('tree utilities', () => {
  it('derives tri-state parents from checked leaves and reports values per strategy', () => {
    const leaves = checkedLeafKeys(nodes, ['brand', 'components'])
    const states = treeCheckStates(nodes, leaves)
    expect(states.get('string:design')).toBe('mixed')
    expect(states.get('string:ui')).toBe('mixed')
    expect(states.get('string:eng')).toBe(false)
    const all = checkedLeafKeys(nodes, ['design'])
    expect(checkedValues(nodes, all, 'all')).toEqual(['design', 'brand', 'ui', 'components', 'icons'])
    expect(checkedValues(nodes, all, 'parent')).toEqual(['design'])
    expect(checkedValues(nodes, all, 'leaf')).toEqual(['brand', 'components', 'icons'])
  })

  it('computes connector columns from the last-child flags of a row and its ancestors', () => {
    expect(treeGuides([], false)).toEqual([])
    expect(treeGuides([true], false)).toEqual(['tee'])
    expect(treeGuides([true], true)).toEqual(['end'])
    // A grandchild under a middle child continues its parent's line; under a last child it does not.
    expect(treeGuides([false, true], true)).toEqual(['line', 'end'])
    expect(treeGuides([true, false], false)).toEqual(['none', 'tee'])
    expect(treeGuides([false, true, false], true)).toEqual(['line', 'none', 'end'])
  })

  it('keeps checked values the tree has not loaded yet', () => {
    expect(checkedValues(nodes, new Set(['string:brand', 'string:remote']), 'leaf', ['remote'])).toEqual(['brand', 'remote'])
  })

  it('filters to matches and their ancestors, which it opens', () => {
    const result = filterTree(nodes, 'icon')
    expect(result.items.map(node => node.value)).toEqual(['design'])
    expect(result.items[0]!.children!.map(node => node.value)).toEqual(['ui'])
    expect([...result.open]).toEqual(['string:ui', 'string:design'])
  })
})

describe('tree', () => {
  it('expands, selects a single node and exposes tree semantics', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiTree items={nodes} onChange={onChange} ariaLabel="Teams" />)
    const tree = host.querySelector('[role=tree]')!
    expect(tree.getAttribute('aria-label')).toBe('Teams')
    expect(visible(host)).toEqual(['Design', 'Engineering'])
    expect(item(host, 'Design').getAttribute('aria-expanded')).toBe('false')
    await click(item(host, 'Design').querySelector('.lumi-tree__toggle')!)
    expect(visible(host)).toEqual(['Design', 'Brand', 'Product UI', 'Engineering'])
    expect(item(host, 'Brand').getAttribute('aria-level')).toBe('2')
    await click(item(host, 'Brand').querySelector('.lumi-tree__row')!)
    expect(onChange).toHaveBeenLastCalledWith('brand')
    expect(item(host, 'Brand').getAttribute('aria-selected')).toBe('true')
  })

  it('moves with the arrow keys, opens and closes branches and selects with Enter', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiTree items={nodes} onChange={onChange} />)
    const tree = host.querySelector('[role=tree]')!
    expect(item(host, 'Design').tabIndex).toBe(0)
    await act(async () => item(host, 'Design').focus())
    await key(tree, 'ArrowRight')
    expect(item(host, 'Design').getAttribute('aria-expanded')).toBe('true')
    await key(tree, 'ArrowRight')
    expect(document.activeElement).toBe(item(host, 'Brand'))
    await key(tree, 'ArrowDown')
    expect(document.activeElement).toBe(item(host, 'Product UI'))
    await key(tree, 'ArrowLeft')
    expect(document.activeElement).toBe(item(host, 'Design'))
    await key(tree, 'ArrowLeft')
    expect(item(host, 'Design').getAttribute('aria-expanded')).toBe('false')
    await key(tree, 'e')
    expect(document.activeElement).toBe(item(host, 'Engineering'))
    await key(tree, 'Enter')
    expect(onChange).toHaveBeenLastCalledWith('eng')
  })

  it('checks a branch with tri-state parents and skips disabled leaves', async () => {
    function Checked(): ReactNode {
      const [value, setValue] = useState<OptionValue[]>(['brand'])
      return <LumiTree items={nodes} checkable checkStrategy="leaf" defaultExpandAll value={value} onChange={next => setValue(next as OptionValue[])} />
    }
    const host = await mount(<Checked />)
    expect(item(host, 'Design').getAttribute('aria-checked')).toBe('mixed')
    await click(item(host, 'Product UI').querySelector('.lumi-tree__row')!)
    expect(item(host, 'Design').getAttribute('aria-checked')).toBe('true')
    await click(item(host, 'Engineering').querySelector('.lumi-tree__row')!)
    expect(item(host, 'API').getAttribute('aria-checked')).toBe('true')
    expect(item(host, 'Frontend').getAttribute('aria-checked')).toBe('false')
    expect(item(host, 'Engineering').getAttribute('aria-checked')).toBe('mixed')
  })

  it('loads children the first time a lazy node opens and shows a spinner meanwhile', async () => {
    let resolve!: () => void
    function Lazy(): ReactNode {
      const [items, setItems] = useState<CascaderOption[]>([{ value: 1, label: 'Root' }, { value: 2, label: 'Leaf', isLeaf: true }])
      const load = vi.fn((node: CascaderOption) => new Promise<void>((done) => {
        resolve = () => {
          setItems(current => current.map(entry => entry.value === node.value ? { ...entry, children: [{ value: 3, label: 'Child', isLeaf: true }] } : entry))
          done()
        }
      }))
      return <LumiTree items={items} onLoadChildren={load} />
    }
    const host = await mount(<Lazy />)
    expect(item(host, 'Leaf').hasAttribute('aria-expanded')).toBe(false)
    await click(item(host, 'Root').querySelector('.lumi-tree__toggle')!)
    expect(item(host, 'Root').getAttribute('aria-busy')).toBe('true')
    await act(async () => resolve())
    expect(item(host, 'Root').hasAttribute('aria-busy')).toBe(false)
    expect(visible(host)).toEqual(['Root', 'Child', 'Leaf'])
  })

  it('highlights search matches and opens their ancestors', async () => {
    const host = await mount(<LumiTree items={nodes} searchable />)
    await type(host.querySelector('input')!, 'comp')
    expect(visible(host)).toEqual(['Design', 'Product UI', 'Components'])
    expect(host.querySelector('mark')?.textContent).toBe('Comp')
    await type(host.querySelector('input')!, 'zzz')
    expect(host.querySelector('[role=status]')?.textContent).toBe('No matches')
  })

  it('draws tee and elbow connectors per visible row, a stem under open parents, and none without showLine', async () => {
    const guides = (host: ParentNode, label: string): (string | null)[] =>
      Array.from(item(host, label).querySelector('.lumi-tree__row')!.querySelectorAll('.lumi-tree__guide'), span => span.getAttribute('data-guide'))
    const host = await mount(<LumiTree items={nodes} defaultExpandAll />)
    expect(guides(host, 'Design')).toEqual(['stem'])
    expect(guides(host, 'Brand')).toEqual(['tee'])
    expect(guides(host, 'Product UI')).toEqual(['end', 'stem'])
    expect(guides(host, 'Icons')).toEqual(['end'])
    expect(guides(host, 'Components')).toEqual(['tee'])
    expect(guides(host, 'Frontend')).toEqual(['end'])
    const searched = await mount(<LumiTree items={nodes} searchable />)
    await type(searched.querySelector('input')!, 'comp')
    expect(guides(searched, 'Product UI')).toEqual(['end', 'stem'])
    expect(guides(searched, 'Components')).toEqual(['end'])
    const plain = await mount(<LumiTree items={nodes} defaultExpandAll showLine={false} />)
    expect(plain.querySelectorAll('.lumi-tree__guide')).toHaveLength(0)
  })

  it('applies defaultExpandAll when the items arrive after mount', async () => {
    function Later(): ReactNode {
      const [items, setItems] = useState<CascaderOption[]>([])
      return (
        <>
          <button type="button" onClick={() => setItems(nodes)}>load</button>
          <LumiTree items={items} defaultExpandAll />
        </>
      )
    }
    const host = await mount(<Later />)
    await click(host.querySelector('button')!)
    expect(visible(host)).toContain('Components')
  })
})

describe('tree select', () => {
  it('names a chosen node it has not loaded through selectedNodes, with its path', async () => {
    const host = await mount(<LumiTreeSelect items={[]} value={9} showPath selectedNodes={[{ value: 1, label: 'Electronics', children: [{ value: 9, label: 'Speakers' }] }]} />)
    expect(host.querySelector('[role=combobox]')?.textContent).toBe('Electronics / Speakers')
  })

  it('opens on its chosen node, picks one and closes', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiTreeSelect items={nodes} defaultValue="icons" onChange={onChange} ariaLabel="Team" />)
    const trigger = host.querySelector<HTMLElement>('[role=combobox]')!
    expect(trigger.textContent).toBe('Icons')
    await key(trigger, 'ArrowDown')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(visible(document.body)).toEqual(['Design', 'Brand', 'Product UI', 'Components', 'Icons', 'Engineering'])
    await click(item(document.body, 'Brand').querySelector('.lumi-tree__row')!)
    expect(onChange).toHaveBeenLastCalledWith('brand')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.textContent).toBe('Brand')
  })

  it('stays open for multiple picks, shows two tags and a count, and clears', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiTreeSelect items={nodes} checkable clearable defaultExpandAll defaultValue={['brand', 'components', 'icons']} onChange={onChange} />)
    const trigger = host.querySelector<HTMLElement>('[role=combobox]')!
    expect(Array.from(trigger.querySelectorAll('.lumi-select-chip'), chip => chip.textContent)).toEqual(['Brand', 'Components'])
    expect(trigger.textContent).toContain('+1')
    await key(trigger, 'ArrowDown')
    await click(item(document.body, 'API').querySelector('.lumi-tree__row')!)
    expect(onChange).toHaveBeenLastCalledWith(['design', 'brand', 'ui', 'components', 'icons', 'api'])
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    await click(host.querySelector('[aria-label="Clear selection"]')!)
    expect(onChange).toHaveBeenLastCalledWith([])
  })
})

const regions: CascaderOption[] = [
  { value: 'cn', label: 'China', children: [{ value: 'zj', label: 'Zhejiang', children: [{ value: 'hz', label: 'Hangzhou' }, { value: 'nb', label: 'Ningbo' }] }] },
  { value: 'jp', label: 'Japan', children: [{ value: 'tokyo', label: 'Tokyo' }] },
]

function option(host: ParentNode, label: string): HTMLElement {
  const found = [...host.querySelectorAll<HTMLElement>('[role=option]')].find(element => element.textContent === label)
  if (!found)
    throw new Error(`No option ${label}`)
  return found
}

describe('cascader panel', () => {
  it('opens one column per level and commits a leaf path', async () => {
    const onChange = vi.fn()
    const host = await mount(<LumiCascaderPanel options={regions} onChange={onChange} />)
    expect(host.querySelectorAll('[role=listbox]')).toHaveLength(1)
    await click(option(host, 'China'))
    await click(option(host, 'Zhejiang'))
    expect(host.querySelectorAll('[role=listbox]')).toHaveLength(3)
    expect(onChange).not.toHaveBeenCalled()
    await click(option(host, 'Ningbo'))
    expect(onChange).toHaveBeenLastCalledWith(['cn', 'zj', 'nb'])
    expect(option(host, 'Ningbo').getAttribute('aria-selected')).toBe('true')
  })

  it('checks leaves across branches as paths, with mixed parents', async () => {
    function Multi(): ReactNode {
      const [value, setValue] = useState<OptionValue[][]>([['jp', 'tokyo']])
      return <LumiCascaderPanel options={regions} multiple value={value} onChange={next => setValue(next as OptionValue[][])} />
    }
    const host = await mount(<Multi />)
    expect(option(host, 'Japan').getAttribute('aria-checked')).toBe('true')
    await click(option(host, 'China'))
    await click(option(host, 'Zhejiang'))
    await click(option(host, 'Hangzhou'))
    expect(option(host, 'China').getAttribute('aria-checked')).toBe('mixed')
    expect(host.querySelector<HTMLInputElement>('input[type=hidden]')).toBeNull()
    await click(option(host, 'Ningbo'))
    expect(option(host, 'China').getAttribute('aria-checked')).toBe('true')
  })

  it('shows a loading column while a lazy level is requested', async () => {
    let resolve!: () => void
    function Lazy(): ReactNode {
      const [options, setOptions] = useState<CascaderOption[]>([{ value: 1, label: 'Root' }])
      const load = (): Promise<void> => new Promise((done) => {
        resolve = () => {
          setOptions([{ value: 1, label: 'Root', children: [{ value: 2, label: 'Child', isLeaf: true }] }])
          done()
        }
      })
      return <LumiCascaderPanel options={options} onLoadChildren={load} />
    }
    const host = await mount(<Lazy />)
    await click(option(host, 'Root'))
    expect(host.querySelectorAll('[role=listbox]')[1]?.getAttribute('aria-busy')).toBe('true')
    await act(async () => resolve())
    expect(option(host, 'Child')).toBeTruthy()
  })
})

describe('cascader', () => {
  it('keeps static options and loads a lazy level on demand', async () => {
    const load = vi.fn(async () => {})
    const host = await mount(<LumiCascader options={[{ value: 1, label: 'Root' }]} onLoadChildren={load} ariaLabel="Place" />)
    await click(host.querySelector('[aria-haspopup=listbox]')!)
    await click(option(document.body, 'Root'))
    expect(document.querySelectorAll('[role=listbox][aria-busy=true]')).toHaveLength(1)
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ value: 1 }))
  })
})
