// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { ComponentRegistry } from '@json-render/react'
import type { PropsWithChildren, ReactNode } from 'react'
import type { AdminManifest } from '../src/catalog.js'
import { createLumi, useModal } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { createAdmin, useAdminDrawer, useUnsavedChangesGuard } from '../src/react/index.js'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const dataProvider = {
  async getList() { return { data: [], total: 0 } },
  async getOne() { return { data: {} } },
  async create() { return { data: {} } },
  async update() { return { data: {} } },
  async deleteOne() { return { data: {} } },
} as unknown as DataProvider

const testComponents = {
  Badge: ({ label }: { label?: unknown }) => <span>{String(label ?? '')}</span>,
  Dialog: (props: PropsWithChildren<{ open?: boolean, title?: string, description?: string, confirmText?: string, cancelText?: string, onConfirm?: () => void, onOpenChange?: (open: boolean) => void }>) => props.open
    ? (
        <div role="dialog" aria-label={props.title}>
          <p>{props.description}</p>
          {props.children}
          <button type="button" onClick={() => props.onOpenChange?.(false)}>{props.cancelText ?? 'Close modal'}</button>
          {props.confirmText && <button type="button" onClick={props.onConfirm}>{props.confirmText}</button>}
        </div>
      )
    : null,
  Drawer: (props: PropsWithChildren<{ open?: boolean, title?: string, description?: string, size?: string, footerStart?: ReactNode, footerEnd?: ReactNode, onOpenChange?: (open: boolean) => void }>) => props.open
    ? (
        <div role="dialog" aria-label={props.title} data-size={props.size}>
          <p>{props.description}</p>
          {props.children}
          {props.footerStart}
          {props.footerEnd}
          <button type="button" onClick={() => props.onOpenChange?.(false)}>Close drawer</button>
        </div>
      )
    : null,
}
const registry: ComponentRegistry = Object.fromEntries(Object.entries(testComponents).map(([name, Component]) => [name, ({ element }) => <Component {...element.props as any} />]))

const manifest: AdminManifest = {

  app: { id: 'drawer-test', title: 'Drawer Test' },
  routes: [{ name: 'home', path: '/', page: { spec: { root: 'page', elements: { page: { type: 'Badge', props: { label: 'Home' }, children: [] } } } } }],
}

function Shell({ children }: PropsWithChildren) {
  return <main>{children}</main>
}

function DrawerLauncher() {
  const drawer = useAdminDrawer()
  return (
    <>
      <button type="button" onClick={() => drawer.open('edit')}>Open drawer</button>
      <button type="button" onClick={() => drawer.open('inspect')}>Inspect drawer</button>
    </>
  )
}

function RecordDrawerLauncher() {
  const drawer = useAdminDrawer()
  return <button type="button" onClick={() => drawer.open('edit', 7)}>Open record</button>
}

function DirtyDrawer() {
  const drawer = useAdminDrawer()
  useUnsavedChangesGuard({ dirty: true, owner: 'dirty-drawer' })
  return (
    <>
      <p>Dirty drawer content</p>
      <button type="button" onClick={drawer.close}>Programmatic close</button>
    </>
  )
}

function ModalLauncher() {
  const modal = useModal()
  return (
    <button
      type="button"
      onClick={() => modal.open({
        title: 'Edit profile',
        render: () => <DirtyModal />,
      })}
    >
      Open modal
    </button>
  )
}

function DirtyModal() {
  useUnsavedChangesGuard({ dirty: true, owner: 'dirty-modal' })
  return <p>Dirty modal content</p>
}

function memoryRouter(initialEntry: string) {
  return (routes: Parameters<typeof createMemoryRouter>[0]) => createMemoryRouter(routes, { initialEntries: [initialEntry] })
}

async function click(element: Element): Promise<void> {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
}

function buttonByText(container: ParentNode, text: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll('button')].find(candidate => candidate.textContent === text || candidate.getAttribute('aria-label') === text || (text === 'Close modal' && candidate.textContent === 'Close'))
  if (!button)
    throw new Error(`Button "${text}" was not rendered`)
  return button
}

describe('routed drawers and unsaved overlay changes', () => {
  it('pushes an application-opened drawer and closes it through browser history', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      shell: Shell,
      routes: [{ id: 'drawer-demo', path: '/drawer-demo', element: <DrawerLauncher /> }],
      drawers: { edit: { title: 'Edit item', component: () => <p>Drawer content</p> } },
      createRouter: memoryRouter('/drawer-demo'),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))

    await click(buttonByText(container, 'Open drawer'))
    await vi.waitFor(() => expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo?drawer=edit'))
    expect(admin.getRouter()?.state.historyAction).toBe('PUSH')
    expect(findDialog('Edit item')).not.toBeNull()

    await click(buttonByText(container, 'Close drawer'))
    await vi.waitFor(() => expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo'))
    expect(admin.getRouter()?.state.historyAction).toBe('POP')

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('carries a record id in the drawer query and removes it on close', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      shell: Shell,
      routes: [{ id: 'drawer-demo', path: '/drawer-demo', element: <RecordDrawerLauncher /> }],
      drawers: { edit: { title: 'Edit item', size: 'md', component: () => <p>Drawer content</p> } },
      createRouter: memoryRouter('/drawer-demo'),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    await click(buttonByText(container, 'Open record'))
    await vi.waitFor(() => expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo?drawer=edit&record=7'))
    expect(document.body.querySelector('[data-size="md"]')).not.toBeNull()
    await click(buttonByText(container, 'Close drawer'))
    await vi.waitFor(() => expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo'))
    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('replaces direct drawer switches without inventing an application-opened history entry', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      shell: Shell,
      routes: [{ id: 'drawer-demo', path: '/drawer-demo', element: <DrawerLauncher /> }],
      drawers: {
        edit: { title: 'Edit item', component: () => <p>Edit content</p> },
        inspect: { title: 'Inspect item', component: () => <p>Inspect content</p> },
      },
      createRouter: memoryRouter('/drawer-demo?drawer=edit'),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))

    await click(buttonByText(container, 'Inspect drawer'))
    await vi.waitFor(() => expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo?drawer=inspect'))
    expect(admin.getRouter()?.state.historyAction).toBe('REPLACE')
    await click(buttonByText(container, 'Close drawer'))
    await vi.waitFor(() => expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo'))
    expect(admin.getRouter()?.state.historyAction).toBe('REPLACE')

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('keeps a dirty shared drawer URL until the user confirms closing it', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      shell: Shell,
      routes: [{ id: 'drawer-demo', path: '/drawer-demo', element: <DrawerLauncher /> }],
      drawers: { edit: { title: 'Edit item', component: DirtyDrawer } },
      createRouter: memoryRouter('/drawer-demo?drawer=edit'),
    })
    await admin.ready()
    const navigate = vi.spyOn(admin.getRouter()!, 'navigate')
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    await vi.waitFor(() => expect(document.body.textContent).toContain('Dirty drawer content'))

    await click(buttonByText(container, 'Close drawer'))
    await click(buttonByText(container, 'Close drawer'))
    expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo?drawer=edit')
    expect(findDialog('Discard unsaved changes?')).not.toBeNull()

    await click(buttonByText(container, 'Keep editing'))
    expect(findDialog('Discard unsaved changes?')).toBeNull()
    expect(findDialog('Edit item')).not.toBeNull()

    await click(buttonByText(container, 'Programmatic close'))
    await click(buttonByText(container, 'Programmatic close'))
    await click(buttonByText(container, 'Discard and leave'))
    await vi.waitFor(() => expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo'))
    expect(admin.getRouter()?.state.historyAction).toBe('REPLACE')
    expect(navigate.mock.calls.filter(([target]) => target === '/drawer-demo')).toHaveLength(1)

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('blocks browser back while an application-opened drawer is dirty', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      shell: Shell,
      routes: [{ id: 'drawer-demo', path: '/drawer-demo', element: <DrawerLauncher /> }],
      drawers: { edit: { title: 'Edit item', component: DirtyDrawer } },
      createRouter: memoryRouter('/drawer-demo'),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))
    await click(buttonByText(container, 'Open drawer'))
    await vi.waitFor(() => expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo?drawer=edit'))

    await act(async () => {
      await admin.getRouter()?.navigate(-1)
    })
    expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo?drawer=edit')
    expect(findDialog('Discard unsaved changes?')).not.toBeNull()

    await click(buttonByText(container, 'Keep editing'))
    expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo?drawer=edit')
    await act(async () => {
      await admin.getRouter()?.navigate(-1)
    })
    await click(buttonByText(container, 'Discard and leave'))
    await vi.waitFor(() => expect(admin.context.routerProvider?.getCurrentPath()).toBe('/drawer-demo'))
    expect(admin.getRouter()?.state.historyAction).toBe('POP')

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })

  it('uses the same confirmation flow for dirty imperative modals without changing the URL', async () => {
    const admin = createAdmin({
      context: createLumi({ dataProvider }),
      registry,
      manifest,
      shell: Shell,
      routes: [{ id: 'modal-demo', path: '/modal-demo', element: <ModalLauncher /> }],
      createRouter: memoryRouter('/modal-demo'),
    })
    await admin.ready()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<admin.App />))

    await click(buttonByText(container, 'Open modal'))
    const modal = await vi.waitFor(() => {
      const element = findDialog('Edit profile')
      expect(element).not.toBeNull()
      return element!
    })
    await click(buttonByText(modal, 'Close modal'))
    expect(admin.context.routerProvider?.getCurrentPath()).toBe('/modal-demo')
    expect(findDialog('Edit profile')).not.toBeNull()
    expect(findDialog('Discard unsaved changes?')).not.toBeNull()

    await click(buttonByText(container, 'Keep editing'))
    expect(findDialog('Edit profile')).not.toBeNull()
    await click(buttonByText(modal, 'Close modal'))
    await click(buttonByText(container, 'Discard and leave'))
    await vi.waitFor(() => expect(findDialog('Edit profile')).toBeNull())
    expect(admin.context.routerProvider?.getCurrentPath()).toBe('/modal-demo')

    await act(async () => root.unmount())
    container.remove()
    admin.dispose()
  })
})

function findDialog(title: string): Element | null {
  return [...document.body.querySelectorAll('[role="dialog"]')].find(element => element.getAttribute('aria-label') === title || document.getElementById(element.getAttribute('aria-labelledby') ?? '')?.textContent === title) ?? null
}
