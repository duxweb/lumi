// @vitest-environment jsdom
import type { DataProvider } from '@duxweb/lumi'
import type { ComponentType, ReactNode } from 'react'
import { createLumi, LumiProvider, useForm } from '@duxweb/lumi'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import {
  LumiDataGrid,
  LumiFilterBar,
  LumiFormPage,
  LumiListPage,
  LumiPage,
  LumiPageFrame,
  LumiPageHeader,
  LumiSettingsPage,
  LumiSettingsRow,
  LumiUnsavedChangesProvider,
} from '../src/react/index.js';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const calls = {
  frame: vi.fn(),
  filters: vi.fn(),
  table: vi.fn(),
  pagination: vi.fn(),
  tabs: vi.fn(),
}

const components = {
  Alert: ({ title, message, role }: any) => (
    <div data-testid="alert" role={role}>
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  ),
  Badge: ({ label, tone }: any) => (
    <span data-testid="badge" data-tone={tone}>
      {label}
    </span>
  ),
  Button: ({ label, type = 'button', disabled, loading, onClick }: any) => (
    <button type={type} disabled={disabled || loading} onClick={onClick}>
      {label}
    </button>
  ),
  Dialog: ({
    open,
    title,
    description,
    confirmText,
    cancelText,
    onConfirm,
    onOpenChange,
  }: any) =>
    open
      ? (
          <div role="dialog" aria-label={title}>
            <p>{description}</p>
            <button type="button" onClick={() => onOpenChange?.(false)}>
              {cancelText}
            </button>
            <button type="button" onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        )
      : null,
  Form: ({ children, disabled, onSubmit }: any) => (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.({})
      }}
    >
      <fieldset disabled={disabled}>{children}</fieldset>
    </form>
  ),
  Frame: (props: any) => {
    calls.frame(props)
    return (
      <section data-testid="frame">
        <h2>{props.title}</h2>
        {props.titleEnd}
        {props.headerStart}
        {props.headerEnd}
        {props.aside}
        {props.body ?? props.children}
        <footer>{props.summary}</footer>
      </section>
    )
  },
  Filters: (props: any) => {
    calls.filters(props)
    return (
      <div>
        {props.toolbarStart}
        <button
          type="button"
          onClick={() => props.onChange?.({ query: 'lumi' })}
        >
          Emit filters
        </button>
        {props.toolbarEnd}
      </div>
    )
  },
  Pagination: (props: any) => {
    calls.pagination(props)
    return (
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => props.onPageChange?.(2)}
      >
        Page two
      </button>
    )
  },
  Table: (props: any) => {
    calls.table(props)
    return (
      <table>
        <tbody>
          {props.rows.map((row: any, index: number) => (
            <tr key={index}>
              <td>{row.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  },
  Tabs: ({
    items,
    children,
    value,
    defaultValue,
    onChange,
    className,
  }: any) => {
    calls.tabs({ items, children, value, defaultValue, onChange, className })
    const active = value ?? defaultValue ?? items[0]?.value
    const panels = Array.isArray(children) ? children : [children]
    return (
      <div className={className}>
        <div role="tablist" aria-orientation="horizontal">
          {items.map((item: any) => (
            <button
              role="tab"
              aria-selected={item.value === active}
              key={item.value}
              disabled={item.disabled}
              onClick={() => onChange?.(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {panels[items.findIndex((item: any) => item.value === active)]}
      </div>
    )
  },
} satisfies Record<string, ComponentType<any>>

const registry = {}
const provider = {
  getList: async () => ({ data: [], total: 0 }),
  getOne: async () => ({ data: {} }),
  create: vi.fn(async ({ variables }) => ({ data: variables })),
  update: async ({ variables }: any) => ({ data: variables }),
  deleteOne: async () => ({ data: {} }),
} as unknown as DataProvider

async function render(element: ReactNode, registry = {}) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () =>
    root.render(
      <LumiProvider
        context={createLumi({ dataProvider: provider })}
        registry={registry}
      >
        {element}
      </LumiProvider>,
    ),
  )
  const cleanup = async (): Promise<void> => {
    await act(async () => root.unmount())
    container.remove()
  }
  return { container, cleanup }
}

vi.mock('@duxweb/lumi-ui', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    LumiAlert: (props: any) => components.Alert(props),
    LumiBadge: (props: any) => components.Badge(props),
    LumiButton: (props: any) => components.Button(props),
    LumiDialog: (props: any) => components.Dialog(props),
    LumiForm: (props: any) => components.Form(props),
    LumiFrame: (props: any) => components.Frame(props),
    LumiFilters: (props: any) => components.Filters(props),
    LumiPagination: (props: any) => components.Pagination(props),
    LumiTable: (props: any) => components.Table(props),
    LumiTabs: (props: any) => components.Tabs(props),
  }
})

/** Form pages guard navigation, so they need a router and the guard provider. */
async function renderRouted(element: ReactNode) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <LumiUnsavedChangesProvider>{element}</LumiUnsavedChangesProvider>
      ),
    },
  ])
  const mounted = await render(<RouterProvider router={router} />)
  return {
    ...mounted,
    cleanup: async () => {
      await mounted.cleanup()
      await router.dispose()
    },
  }
}

describe('admin page composition', () => {
  it('keeps route breadcrumbs in the shell instead of duplicating them in page content', async () => {
    const legacyHeader = {
      title: 'Create product',
      breadcrumbs: [
        { label: 'Products', href: '/products' },
        { label: 'New product' },
      ],
    }
    const mounted = await render(<LumiPageHeader {...legacyHeader} />)
    expect(
      mounted.container.querySelector('nav[aria-label="Breadcrumb"]'),
    ).toBeNull()
    await mounted.cleanup()
  })

  it('renders recoverable states with a reason, next step, and accessible action', async () => {
    const retry = vi.fn()
    const mounted = await render(
      <LumiPage
        state={{
          kind: 'offline',
          title: 'Offline',
          reason: 'The service is unreachable.',
          nextStep: 'Reconnect and retry.',
          actionLabel: 'Retry',
          onAction: retry,
        }}
      />,
    )
    const alert = mounted.container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('The service is unreachable.')
    expect(alert?.textContent).toContain('Reconnect and retry.')
    expect(mounted.container.querySelectorAll('[role="alert"]')).toHaveLength(
      1,
    )
    await act(async () =>
      mounted.container.querySelector<HTMLButtonElement>('button')!.click(),
    )
    expect(retry).toHaveBeenCalledOnce()
    expect(mounted.container.querySelector('.lumi-admin-page')).not.toBeNull()
    expect(mounted.container.querySelector('.lumi-page')).toBeNull()
    await mounted.cleanup()
  })

  it('offers the next task from a standalone success result', async () => {
    const next = vi.fn()
    const mounted = await render(
      <LumiPage state={{ kind: 'success', title: 'Order submitted', message: 'Fulfilment picks it up next.', actionLabel: 'Back to orders', onAction: next }} />,
    )
    expect(mounted.container.querySelector('[role="status"]')?.textContent).toContain('Fulfilment picks it up next.')
    expect(mounted.container.querySelector('.lumi-admin-page')?.getAttribute('data-page-state')).toBe('success')
    await act(async () =>
      mounted.container.querySelector<HTMLButtonElement>('button')!.click(),
    )
    expect(next).toHaveBeenCalledOnce()
    await mounted.cleanup()
  })

  it('composes UI Frame, Filters, Table, and Pagination events', async () => {
    const filterChange = vi.fn()
    const pageChange = vi.fn()
    const mounted = await render(
      <LumiPageFrame
        title="Products"
        tools={(
          <LumiFilterBar
            schema={{ fields: [] }}
            applyMode="immediate"
            onChange={filterChange}
          />
        )}
      >
        <LumiDataGrid
          rows={[{ id: 1, name: 'Lumi' }]}
          columns={[{ field: 'name', label: 'Name' }]}
          page={1}
          pageSize={10}
          total={21}
          onPageChange={pageChange}
        />
      </LumiPageFrame>,
    )
    expect(calls.frame).toHaveBeenCalled()
    expect(calls.filters).toHaveBeenCalledWith(
      expect.objectContaining({
        applyMode: 'immediate',
        schema: { fields: [] },
      }),
    )
    expect(calls.table).toHaveBeenCalledWith(
      expect.objectContaining({ rows: [{ id: 1, name: 'Lumi' }] }),
    )
    expect(calls.pagination).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, total: 21 }),
    )
    const buttons = [...mounted.container.querySelectorAll('button')]
    await act(async () =>
      buttons.find(button => button.textContent === 'Emit filters')!.click(),
    )
    await act(async () =>
      buttons.find(button => button.textContent === 'Page two')!.click(),
    )
    expect(filterChange).toHaveBeenCalledWith({ query: 'lumi' })
    expect(pageChange).toHaveBeenCalledWith(2)
    await mounted.cleanup()
  })

  it('renders column-preserving skeleton rows and one actionable empty explanation', async () => {
    const mounted = await render(
      <LumiDataGrid
        rows={[]}
        columns={[
          { field: 'name', label: 'Name' },
          { field: 'status', label: 'Status' },
        ]}
        page={1}
        pageSize={10}
        total={0}
        loading
        onPageChange={() => {}}
      />,
    )
    expect(calls.table).toHaveBeenLastCalledWith(
      expect.objectContaining({
        loading: false,
        rows: expect.arrayContaining([
          expect.objectContaining({ name: '', status: '' }),
        ]),
      }),
    )
    expect(
      mounted.container
        .querySelector('.lumi-data-grid')
        ?.getAttribute('aria-busy'),
    ).toBe('true')
    await mounted.cleanup()

    const empty = await render(
      <LumiDataGrid
        rows={[]}
        columns={[{ field: 'name', label: 'Name' }]}
        page={1}
        pageSize={10}
        total={0}
        onPageChange={() => {}}
      />,
    )
    expect(empty.container.textContent?.match(/No results/g)).toHaveLength(1)
    // The grid's own state is the in-table size, one family with Table's empty row.
    expect(empty.container.querySelector('.lumi-data-grid [data-slot="empty"]')?.getAttribute('data-size')).toBe('sm')
    expect(empty.container.textContent).toContain(
      'Adjust the filters or create a new record.',
    )
    await empty.cleanup()
  })

  it.each(['loading', 'disabled'] as const)(
    'removes every business interaction while the grid is %s',
    async (mode) => {
      const handlers = {
        page: vi.fn(),
        pageSize: vi.fn(),
        sort: vi.fn(),
        row: vi.fn(),
        action: vi.fn(),
        selection: vi.fn(),
      }
      const mounted = await render(
        <LumiDataGrid
          rows={[{ id: 1, name: 'Lumi' }]}
          columns={[
            { field: 'name', label: 'Name', sortable: true },
            {
              field: 'actions',
              label: 'Actions',
              kind: 'actions',
              actions: [{ value: 'edit', label: 'Edit' }],
            },
          ]}
          selectable
          selectedKeys={[1]}
          page={1}
          pageSize={10}
          total={1}
          loading={mode === 'loading'}
          disabled={mode === 'disabled'}
          onPageChange={handlers.page}
          onPageSizeChange={handlers.pageSize}
          onSort={handlers.sort}
          onRowClick={handlers.row}
          onRowAction={handlers.action}
          onSelectionChange={handlers.selection}
        />,
      )
      const table = calls.table.mock.lastCall?.[0]
      const pagination = calls.pagination.mock.lastCall?.[0]
      if (mode === 'loading') {
        expect(table).toEqual(
          expect.objectContaining({
            selectable: false,
            selectedKeys: [],
            onSort: undefined,
            onRowClick: undefined,
            onRowAction: undefined,
            onSelectionChange: undefined,
          }),
        )
        expect(table.columns).toEqual([
          expect.objectContaining({ field: 'name', sortable: false }),
          expect.objectContaining({
            field: 'actions',
            sortable: false,
            actions: [],
          }),
        ])
      }
      else {
        // A refetch keeps the same chrome so the table does not jump; input is
        // swallowed until it settles.
        expect(table).toEqual(expect.objectContaining({ selectable: true, selectedKeys: [1] }))
        expect(table.columns[0]).toEqual(expect.objectContaining({ field: 'name', sortable: true }))
        table.onSort?.([{ field: 'name', order: 'asc' }])
        table.onRowClick?.({ id: 1 })
        table.onRowAction?.({ action: 'edit', row: { id: 1 } })
        table.onSelectionChange?.([])
        expect(mounted.container.querySelector('.lumi-data-grid')?.getAttribute('data-busy')).toBe('true')
      }
      pagination.onPageChange(2)
      pagination.onPageSizeChange?.(20)
      expect(
        Object.values(handlers).every(
          handler => handler.mock.calls.length === 0,
        ),
      ).toBe(true)
      if (mode === 'loading') {
        expect(
          mounted.container
            .querySelector('.lumi-data-grid__scroll')
            ?.getAttribute('aria-hidden'),
        ).toBe('true')
        expect(
          mounted.container
            .querySelector('.lumi-data-grid__scroll')
            ?.getAttribute('tabindex'),
        ).toBeNull()
      }
      expect(
        mounted.container.querySelector<HTMLButtonElement>(
          '.lumi-data-grid__pagination button',
        )?.disabled,
      ).toBe(true)
      await mounted.cleanup()
    },
  )

  it('separates summaries from results and picks one summary tier at a time', async () => {
    const grid = {
      rows: [{ id: 1, name: 'Lumi' }],
      columns: [{ field: 'name', label: 'Name' }],
      page: 1,
      pageSize: 10,
      total: 1,
      onPageChange: vi.fn(),
    }
    const stats = [
      {
        key: 'total',
        label: 'Matching',
        value: 42,
        hint: 'Current filter',
        series: [8, 16, 12, 24],
      },
      {
        key: 'low',
        label: 'Low stock',
        value: 3,
        hint: 'below reorder point',
        change: '-2.0%',
        tone: 'warning' as const,
      },
    ]
    const strip = await render(
      <LumiListPage
        title="Products"
        description="Catalog"
        actions={<button type="button">New product</button>}
        grid={grid}
        stats={stats}
      />,
    )
    expect(
      strip.container.querySelector('.lumi-page-header')?.textContent,
    ).toContain('Products')
    expect(
      strip.container.querySelector('.lumi-page-header')?.textContent,
    ).toContain('Catalog')
    expect(
      strip.container.querySelector('.lumi-list-page__surface'),
    ).not.toBeNull()
    expect(strip.container.querySelector('[data-testid="frame"]')).toBeNull()
    expect(strip.container.querySelector('.lumi-list-page__surface .lumi-stat-strip')).toBeNull()
    expect(strip.container.querySelector('.lumi-list-page > .lumi-stat-strip')).not.toBeNull()
    expect(
      strip.container.querySelector('.lumi-stat-strip')?.textContent,
    ).toContain('42')
    // A figure that is itself the problem carries its tone; a plain total does not.
    const toned = [
      ...strip.container.querySelectorAll<HTMLElement>(
        '.lumi-stat-strip__value',
      ),
    ]
    expect(toned.map(value => value.dataset.tone)).toEqual([
      undefined,
      'warning',
    ])
    expect(
      strip.container.querySelector('.lumi-stat-strip__foot')?.textContent,
    ).toBe('Current filter')
    expect(
      [...strip.container.querySelectorAll('.lumi-stat-strip__foot')].at(-1)?.textContent,
    ).toBe('-2.0%below reorder point')
    const statSpark = [
      ...strip.container.querySelectorAll<HTMLElement>(
        '.lumi-stat-strip__spark i',
      ),
    ]
    expect(statSpark.map(bar => bar.style.height)).toEqual([
      '33.33333333333333%',
      '66.66666666666666%',
      '50%',
      '100%',
    ])
    expect(statSpark.at(-1)?.dataset.last).toBe('true')
    expect(strip.container.querySelector('.lumi-metric-cards')).toBeNull()
    await strip.cleanup()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cards = await render(
      <LumiListPage
        title="Products"
        grid={grid}
        stats={stats}
        kpis={[
          {
            key: 'revenue',
            label: 'Revenue',
            value: '$12,400',
            change: '+8%',
            tone: 'success',
            series: [3, 5, 4, 8],
          },
        ]}
      />,
    )
    expect(
      cards.container.querySelector('.lumi-metric-card[data-scale="sm"]')
        ?.textContent,
    ).toContain('$12,400')
    // The spark is a row of zero-baselined bars, the last one marked as current.
    const spark = [
      ...cards.container.querySelectorAll<HTMLElement>(
        '.lumi-metric-card__spark i',
      ),
    ]
    expect(spark.map(bar => bar.style.height)).toEqual([
      '37.5%',
      '62.5%',
      '50%',
      '100%',
    ])
    expect(spark.at(-1)?.parentElement?.dataset.last).toBe('true')
    expect(cards.container.querySelector('.lumi-stat-strip')).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
    await cards.cleanup()
  })

  it('shapes the row-action column and hides columns from the toolbar menu', async () => {
    const columns = [
      { field: 'name', label: 'Name' },
      { field: 'sku', label: 'SKU' },
      {
        field: 'actions',
        label: 'Actions',
        kind: 'actions' as const,
        actions: [{ value: 'view', label: 'View' }],
      },
    ]
    const mounted = await render(
      <LumiListPage
        title="Products"
        grid={{
          rows: [{ id: 1, name: 'Lumi', sku: 'L-1' }],
          columns,
          page: 1,
          pageSize: 10,
          total: 1,
          onPageChange: vi.fn(),
        }}
        filters={{ schema: { fields: [] }, applyMode: 'immediate' }}
      />,
    )
    const shaped = calls.table.mock.lastCall![0].columns.at(-1)
    expect(shaped).toMatchObject({
      field: 'actions',
      label: '',
      width: '56px',
      align: 'right',
    })
    // The menu offers the data columns only, and never empties the table.
    const items = [
      ...mounted.container.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemcheckbox"]',
      ),
    ]
    expect(items.map(item => item.textContent)).toEqual(['Name', 'SKU'])
    await act(async () => items[1]!.click())
    expect(calls.table.mock.lastCall![0].visibleColumns).toEqual([
      'name',
      'actions',
    ])
    expect(
      mounted.container.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemcheckbox"]',
      )[0]!.disabled,
    ).toBe(true)
    await mounted.cleanup()
  })

  it('lets a list page replace the grid with custom results and a pager', async () => {
    const onPageChange = vi.fn()
    const mounted = await render(
      <LumiListPage
        title="Projects"
        results={<div data-testid="cards">Card results</div>}
        pager={{ page: 1, pageSize: 8, total: 24, onPageChange }}
      />,
    )
    expect(
      mounted.container.querySelector('[data-testid="cards"]')?.textContent,
    ).toBe('Card results')
    expect(calls.table).not.toHaveBeenCalled()
    expect(calls.pagination).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 8, total: 24 }),
    )
    await mounted.cleanup()
  })

  it('splits long forms into tabs and steps and keeps one commit per layout', async () => {
    const sections = [
      {
        key: 'basics',
        label: 'Basics',
        description: 'Name and SKU',
        content: <p>Basics fields</p>,
      },
      {
        key: 'pricing',
        label: 'Pricing',
        description: 'Money',
        content: <p>Pricing fields</p>,
        invalid: true,
        optional: true,
      },
      {
        key: 'media',
        label: 'Media',
        description: 'Images',
        content: <p>Media fields</p>,
      },
    ]
    function TabForm(): ReactNode {
      const form = useForm<{ name: string }>({
        resource: 'products',
        initialValues: { name: '' },
      })
      return (
        <LumiFormPage
          title="Edit product"
          form={form}
          layout="tabs"
          sections={sections}
        />
      )
    }
    const tabs = await renderRouted(<TabForm />)
    const tabButtons = [
      ...tabs.container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ]
    expect(tabButtons.map(tab => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ])
    const pageTabs = tabs.container.querySelector('.lumi-form-page__page-tabs')
    const pageHeader = tabs.container.querySelector('.lumi-page-header')
    expect(pageHeader?.nextElementSibling).toBe(pageTabs)
    expect(pageHeader?.querySelector('h1')?.textContent).toBe('Edit product')
    expect(
      Array.from(
        pageTabs!.querySelectorAll('.lumi-form-page__page-tabs-actions button'),
        button => button.textContent,
      ),
    ).toEqual(['Reset', 'Save'])
    expect(pageHeader?.querySelectorAll('button')).toHaveLength(0)
    expect(
      tabs.container.querySelector('.lumi-form-page__surface > h2.sr-only')
        ?.textContent,
    ).toBe('Edit product form')
    expect(
      tabs.container.querySelector('.lumi-form-page__surface'),
    ).not.toBeNull()
    expect(
      tabs.container.querySelector('.lumi-form-page__surface [role="tablist"]'),
    ).toBeNull()
    expect(tabs.container.querySelector('[data-testid="frame"]')).toBeNull()
    expect(
      tabs.container
        .querySelector('.lumi-admin-page')
        ?.getAttribute('data-width'),
    ).toBe('wide')
    expect(
      tabs.container
        .querySelector('.lumi-admin-page')
        ?.hasAttribute('data-stretch'),
    ).toBe(false)
    expect(
      tabs.container.querySelector('[data-invalid] .lumi-form-page__tab-dot'),
    ).not.toBeNull()
    expect(tabs.container.textContent).toContain('Basics fields')
    await act(async () => tabButtons[1]!.click())
    expect(tabs.container.textContent).toContain('Pricing fields')
    expect(tabs.container.textContent).not.toContain('Basics fields')
    await tabs.cleanup()

    function StepForm(): ReactNode {
      const form = useForm<{ name: string }>({
        resource: 'products',
        initialValues: { name: '' },
      })
      return (
        <LumiFormPage
          title="Create workspace"
          form={form}
          layout="steps"
          sections={sections}
        />
      )
    }
    const steps = await renderRouted(<StepForm />)
    const labels = () =>
      Array.from(
        steps.container.querySelectorAll('button'),
        button => button.textContent,
      )
    expect(
      steps.container.querySelector(
        '.lumi-form-page__toolbar > .lumi-form-page__steps',
      ),
    ).not.toBeNull()
    expect(
      Array.from(
        steps.container.querySelectorAll('.lumi-page-header__actions button'),
        button => button.textContent,
      ),
    ).toEqual(['Reset'])
    // A step form commits in its footer, so the well never offers a second save.
    expect(labels()).not.toContain('Save')
    expect(
      steps.container.querySelector('.lumi-form-page__stepcount')?.textContent,
    ).toBe('Step 1 of 3')
    // The actions close the form itself, and the first step has nothing to go back to.
    expect(
      steps.container.querySelector('form .lumi-form-page__step-panel > .lumi-form-page__stepfoot'),
    ).not.toBeNull()
    expect(labels()).not.toContain('Back')
    expect(
      steps.container.querySelector<HTMLButtonElement>(
        '.lumi-form-page__step-dot',
      )?.disabled,
    ).toBe(false)
    expect(
      [
        ...steps.container.querySelectorAll<HTMLButtonElement>(
          '.lumi-form-page__step-dot',
        ),
      ][2]!.disabled,
    ).toBe(true)
    await act(async () =>
      [...steps.container.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => button.textContent === 'Next')!
        .click(),
    )
    expect(
      steps.container.querySelector('.lumi-form-page__stepcount')?.textContent,
    ).toBe('Step 2 of 3')
    expect(labels()).toContain('Back')
    expect(labels()).toContain('Skip')
    await act(async () =>
      [...steps.container.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => button.textContent === 'Next')!
        .click(),
    )
    expect(labels()).toContain('Finish')
    expect(labels()).not.toContain('Next')
    await steps.cleanup()
  })

  it('gives the publish layout a metadata aside beside the content column', async () => {
    function PublishForm(): ReactNode {
      const form = useForm<{ name: string }>({
        resource: 'products',
        initialValues: { name: '' },
      })
      return (
        <LumiFormPage
          title="New article"
          form={form}
          layout="publish"
          aside={<section>Publishing block</section>}
        >
          <p>Body editor</p>
        </LumiFormPage>
      )
    }
    const mounted = await renderRouted(<PublishForm />)
    expect(
      mounted.container.querySelector('.lumi-form-page__main')?.textContent,
    ).toContain('Body editor')
    expect(
      mounted.container.querySelector('aside.lumi-form-page__aside')
        ?.textContent,
    ).toContain('Publishing block')
    expect(
      mounted.container
        .querySelector('.lumi-admin-page')
        ?.getAttribute('data-width'),
    ).toBe('wide')
    await mounted.cleanup()
  })

  it('guards dirty Settings section changes and renders disabled sections', async () => {
    function Settings(): ReactNode {
      const [value, setValue] = useState('profile')
      const [dirty, setDirty] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setDirty(true)}>
            Edit settings
          </button>
          <LumiSettingsPage
            title="Settings"
            dirty={dirty}
            value={value}
            onChange={setValue}
            actions={<button type="button">Save settings</button>}
            sections={[
              {
                value: 'profile',
                label: 'Profile',
                title: 'Personal info',
                description: 'Update your personal details.',
                layout: 'rows',
                content: (
                  <LumiSettingsRow
                    label="Display name"
                    description="Shown throughout the workspace."
                    required
                    columns={2}
                  >
                    <input aria-label="Display name" />
                    <input aria-label="Public name" />
                  </LumiSettingsRow>
                ),
              },
              {
                value: 'notifications',
                label: 'Notifications',
                title: 'Notifications',
                layout: 'content',
                content: <p>Notifications panel</p>,
              },
              {
                value: 'security',
                label: 'Security',
                disabled: true,
                content: <p>Security panel</p>,
              },
            ]}
          />
        </>
      )
    }
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <LumiUnsavedChangesProvider>
            <Settings />
          </LumiUnsavedChangesProvider>
        ),
      },
    ])
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () =>
      root.render(
        <LumiProvider
          context={createLumi({ dataProvider: provider })}
          registry={registry}
        >
          <RouterProvider router={router} />
        </LumiProvider>,
      ),
    )
    const pageHeader = container.querySelector('.lumi-page-header')
    const pageTop = container.querySelector('.lumi-settings-page__top')
    const tabs = container.querySelector('.lumi-settings-page__tabs')
    const tablist = tabs?.querySelector('[role="tablist"]')
    expect(pageHeader?.querySelector('h1')?.textContent).toBe('Settings')
    expect(pageHeader?.parentElement).toBe(pageTop)
    expect(pageTop?.nextElementSibling).toBe(tabs)
    expect(tablist?.getAttribute('aria-orientation')).toBe('horizontal')
    expect(calls.tabs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: 'profile',
        items: [
          { value: 'profile', label: 'Profile', disabled: undefined },
          {
            value: 'notifications',
            label: 'Notifications',
            disabled: undefined,
          },
          { value: 'security', label: 'Security', disabled: true },
        ],
      }),
    )
    expect(container.querySelector('.lumi-page-frame')).toBeNull()
    expect(
      container.querySelector('.lumi-settings-page__section-header h2')
        ?.textContent,
    ).toBe('Personal info')
    expect(
      container.querySelector('.lumi-settings-page__section-header p')
        ?.textContent,
    ).toBe('Update your personal details.')
    expect(
      container.querySelector(
        '.lumi-settings-page__section-header > .lumi-settings-page__measure',
      ),
    ).not.toBeNull()
    expect(
      container.querySelector('.lumi-settings-row__label')?.textContent,
    ).toContain('Display name')
    expect(
      container.querySelector('.lumi-settings-row__description')?.textContent,
    ).toBe('Shown throughout the workspace.')
    expect(
      container.querySelector(
        '.lumi-settings-row > .lumi-settings-page__measure .lumi-settings-row__control input',
      ),
    ).not.toBeNull()
    expect(
      container
        .querySelector('.lumi-settings-row__control')
        ?.getAttribute('data-columns'),
    ).toBe('2')
    expect(
      container.querySelectorAll('.lumi-settings-row__control > input'),
    ).toHaveLength(2)
    expect(
      container.querySelector(
        '.lumi-settings-page__footer-actions > .lumi-settings-page__measure',
      ),
    ).not.toBeNull()
    expect(tabs?.closest('.lumi-settings-page__measure')).toBeNull()
    expect(
      [...container.querySelectorAll('button')].filter(
        button => button.textContent === 'Save settings',
      ),
    ).toHaveLength(1)
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent,
    ).toBe('Profile')
    expect(
      container.querySelector<HTMLButtonElement>('[role="tab"]:disabled')
        ?.textContent,
    ).toBe('Security')
    await act(async () =>
      [...container.querySelectorAll('button')]
        .find(button => button.textContent === 'Edit settings')!
        .click(),
    )
    await act(async () =>
      [...container.querySelectorAll('button')]
        .find(button => button.textContent === 'Notifications')!
        .click(),
    )
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent,
    ).toBe('Profile')
    await act(async () =>
      [...container.querySelectorAll('button')]
        .find(button => button.textContent === 'Keep editing')!
        .click(),
    )
    expect(container.getElementsByClassName('lumi-settings-row')).toHaveLength(
      1,
    )
    await act(async () =>
      [...container.querySelectorAll('button')]
        .find(button => button.textContent === 'Notifications')!
        .click(),
    )
    await act(async () =>
      [...container.querySelectorAll('button')]
        .find(button => button.textContent === 'Discard and leave')!
        .click(),
    )
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent,
    ).toBe('Notifications')
    expect(container.textContent).toContain('Notifications panel')
    expect(
      container.querySelector(
        '.lumi-settings-page__panel[data-layout="content"] > .lumi-settings-page__measure',
      )?.textContent,
    ).toContain('Notifications panel')
    expect(
      [...container.querySelectorAll('button')].filter(
        button => button.textContent === 'Save settings',
      ),
    ).toHaveLength(1)
    await act(async () => root.unmount())
    container.remove()
    await router.dispose()
  })

  it('supports flat settings tabs with actions owned by a settings row', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <LumiUnsavedChangesProvider>
            <LumiSettingsPage
              title="Account settings"
              sections={[
                {
                  value: 'general',
                  label: 'General',
                  showHeader: false,
                  layout: 'rows',
                  actions: false,
                  content: (
                    <LumiSettingsRow
                      label="Personal information"
                      description="Manage your profile."
                      actions={<button type="button">Save profile</button>}
                    >
                      <input aria-label="Display name" />
                    </LumiSettingsRow>
                  ),
                },
              ]}
            />
          </LumiUnsavedChangesProvider>
        ),
      },
    ])
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () =>
      root.render(
        <LumiProvider
          context={createLumi({ dataProvider: provider })}
          registry={registry}
        >
          <RouterProvider router={router} />
        </LumiProvider>,
      ),
    )
    expect(
      container.querySelector('.lumi-settings-page__section-header'),
    ).toBeNull()
    expect(
      container.querySelector('.lumi-settings-row__actions button')
        ?.textContent,
    ).toBe('Save profile')
    expect(
      container.querySelector('.lumi-settings-page__footer-actions'),
    ).toBeNull()
    await act(async () => root.unmount())
    container.remove()
    await router.dispose()
  })

  it('blocks dirty SPA navigation, supports cancel and proceed, and announces save success', async () => {
    function FormRoute(): ReactNode {
      const form = useForm<{ name: string }>({
        resource: 'products',
        initialValues: { name: '' },
      })
      return (
        <>
          <Link to="/target">Leave form</Link>
          <LumiFormPage title="Edit product" form={form}>
            <label>
              Name
              <input
                aria-label="Name"
                value={form.values.name}
                onChange={event => form.setValue('name', event.target.value)}
              />
            </label>
          </LumiFormPage>
        </>
      )
    }
    const router = createMemoryRouter(
      [
        {
          element: (
            <LumiUnsavedChangesProvider>
              <Outlet />
            </LumiUnsavedChangesProvider>
          ),
          children: [
            { path: '/form', element: <FormRoute /> },
            { path: '/target', element: <p>Target page</p> },
          ],
        },
      ],
      { initialEntries: ['/form'] },
    )
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () =>
      root.render(
        <LumiProvider
          context={createLumi({ dataProvider: provider })}
          registry={registry}
        >
          <RouterProvider router={router} />
        </LumiProvider>,
      ),
    )
    expect(
      Array.from(
        container.querySelectorAll('.lumi-page-header__actions button'),
        button => button.textContent,
      ),
    ).toEqual(['Reset', 'Save'])
    expect(container.querySelector('.lumi-form-page__page-tabs')).toBeNull()
    const input = container.querySelector<HTMLInputElement>('input')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!
      setter.call(input, 'Changed')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    // Every save label stays mounted so the header never reflows; the state picks the visible one.
    const feedback = (): string | null | undefined => container.querySelector('.lumi-form-page__feedback')?.getAttribute('data-save-state')
    expect(feedback()).toBe('dirty')
    expect(container.querySelector('.lumi-form-page__feedback [data-state="dirty"]')?.textContent).toBe('Unsaved')

    await act(async () =>
      container.querySelector<HTMLAnchorElement>('a')!.click(),
    )
    expect(router.state.location.pathname).toBe('/form')
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    await act(async () =>
      [...container.querySelectorAll('button')]
        .find(button => button.textContent === 'Keep editing')!
        .click(),
    )
    expect(router.state.location.pathname).toBe('/form')

    await act(async () =>
      container.querySelector<HTMLAnchorElement>('a')!.click(),
    )
    await act(async () =>
      [...container.querySelectorAll('button')]
        .find(button => button.textContent === 'Discard and leave')!
        .click(),
    )
    expect(router.state.location.pathname).toBe('/target')

    await act(async () => router.navigate('/form'))
    const nextInput = container.querySelector<HTMLInputElement>('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(nextInput, 'Saved')
      nextInput.dispatchEvent(new Event('input', { bubbles: true }))
      nextInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () =>
      [...container.querySelectorAll('button')]
        .find(button => button.textContent === 'Save')!
        .click(),
    )
    await vi.waitFor(() =>
      expect(feedback()).toBe('success'),
    )
    expect(container.querySelector('.lumi-form-page__feedback [data-state="success"]')?.textContent).toBe('Changes saved')
    await act(async () => root.unmount())
    container.remove()
    await router.dispose()
  })
})
