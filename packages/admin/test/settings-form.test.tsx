// @vitest-environment jsdom
import type { DataProvider, ToastProvider, Validator } from '@duxweb/lumi'
import type { ReactNode } from 'react'
import type { LumiSettingsSaveMode } from '../src/react/index.js'
import { createLumi, LumiProvider, useForm } from '@duxweb/lumi'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LumiSettingsForm, LumiUnsavedChangesProvider } from '../src/react/index.js';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface Prefs {
  email: boolean
  digest: boolean
  name: string
}

interface Call {
  variables: Partial<Prefs>
  resolve: () => void
  reject: (error: Error) => void
}

const INITIAL: Prefs = { email: false, digest: false, name: 'Ada' }

function setup(mode: LumiSettingsSaveMode = 'auto') {
  const calls: Call[] = []
  const toast: ToastProvider = { open: vi.fn(() => 'toast') }
  const provider = {
    getList: async () => ({ data: [], total: 0 }),
    getOne: async () => ({ data: INITIAL }),
    create: async ({ variables }: any) => ({ data: variables }),
    update: vi.fn(({ variables }: any) => new Promise((resolve, reject) => {
      calls.push({ variables, resolve: () => resolve({ data: variables }), reject })
    })),
    deleteOne: async () => ({ data: {} }),
  } as unknown as DataProvider
  // Names shorter than two characters are rejected, like a minLength rule.
  const validator: Validator = {
    validate: (_rules, values) => String((values as Partial<Prefs>).name ?? '').length < 2
      ? [{ path: 'name', code: 'min_length', message: 'Name is too short' }]
      : [],
  }

  function Card(): ReactNode {
    const form = useForm<Prefs>({ resource: 'users', id: 1, initialValues: INITIAL, rules: { type: 'object' } })
    return (
      <LumiSettingsForm form={form} saveMode={mode} label="Preferences">
        <input type="checkbox" aria-label="Email" checked={form.values.email} onChange={event => form.setValue('email', event.target.checked)} />
        <input type="checkbox" aria-label="Digest" checked={form.values.digest} onChange={event => form.setValue('digest', event.target.checked)} />
        <input aria-label="Name" value={form.values.name} onChange={event => form.setValue('name', event.target.value)} />
        <output data-testid="error">{form.errors.find(issue => issue.path === 'name')?.message}</output>
        <Link to="/elsewhere">Leave</Link>
      </LumiSettingsForm>
    )
  }

  const router = createMemoryRouter([
    { path: '/', element: <LumiUnsavedChangesProvider><Card /></LumiUnsavedChangesProvider> },
    { path: '/elsewhere', element: <p>Elsewhere</p> },
  ])
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const mount = async (): Promise<void> => {
    await act(async () => root.render(
      <LumiProvider context={createLumi({ dataProvider: provider, toastProvider: toast, validator })} registry={{}}>
        <RouterProvider router={router} />
      </LumiProvider>,
    ))
  }
  const query = <T extends Element>(selector: string): T => container.querySelector<T>(selector)!
  const input = (label: string): HTMLInputElement => query(`input[aria-label="${label}"]`)
  const flush = async (): Promise<void> => {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  }
  const click = async (element: HTMLElement): Promise<void> => {
    await act(async () => element.click())
    await flush()
  }
  const type = async (label: string, value: string): Promise<void> => {
    const field = input(label)
    await act(async () => {
      field.focus()
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await flush()
  }
  const blur = async (label: string): Promise<void> => {
    await act(async () => input(label).blur())
    await flush()
  }
  const settle = async (index: number, outcome: 'resolve' | 'reject' = 'resolve'): Promise<void> => {
    await act(async () => {
      if (outcome === 'resolve')
        calls[index]!.resolve()
      else
        calls[index]!.reject(new Error('Service unavailable'))
    })
    await flush()
  }
  const status = (): string => query('.lumi-settings-row__status')?.textContent ?? ''
  const dialog = (): Element | null => document.querySelector('[role="alertdialog"], [role="dialog"]')
  const cleanup = async (): Promise<void> => {
    await act(async () => root.unmount())
    router.dispose()
    container.remove()
  }
  return { calls, toast, router, container, mount, query, input, click, type, blur, settle, flush, status, dialog, cleanup }
}

let active: ReturnType<typeof setup> | undefined
afterEach(async () => {
  await active?.cleanup()
  active = undefined
})

describe('lumiSettingsForm auto save', () => {
  it('saves a choice as soon as it changes, without a footer', async () => {
    const view = active = setup()
    await view.mount()
    expect(view.query('.lumi-settings-row__actions')).toBeNull()
    await view.click(view.input('Email'))
    expect(view.calls.map(call => call.variables)).toEqual([{ ...INITIAL, email: true }])
    expect(view.status()).toContain('Saving')
    await view.settle(0)
    expect(view.status()).toContain('Saved')
    expect(view.toast.open).not.toHaveBeenCalled()
  })

  it('commits typed fields on blur or Enter, not per keystroke', async () => {
    const view = active = setup()
    await view.mount()
    await view.type('Name', 'Ada Lovelace')
    expect(view.calls).toHaveLength(0)
    await view.blur('Name')
    expect(view.calls.map(call => call.variables.name)).toEqual(['Ada Lovelace'])
    await view.settle(0)

    await view.type('Name', 'Ada L.')
    await act(async () => {
      view.input('Name').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await view.flush()
    expect(view.calls.map(call => call.variables.name)).toEqual(['Ada Lovelace', 'Ada L.'])
  })

  it('keeps an invalid typed value unsent and shows the field error', async () => {
    const view = active = setup()
    await view.mount()
    await view.type('Name', 'A')
    await view.blur('Name')
    expect(view.calls).toHaveLength(0)
    expect(view.query('[data-testid="error"]').textContent).toBe('Name is too short')
    expect(view.status()).not.toContain('Saving')

    await view.type('Name', 'Ann')
    await view.blur('Name')
    expect(view.calls.map(call => call.variables.name)).toEqual(['Ann'])
  })

  it('queues rapid changes behind the save in flight and sends only the latest values', async () => {
    const view = active = setup()
    await view.mount()
    await view.click(view.input('Email'))
    await view.click(view.input('Digest'))
    await view.click(view.input('Email'))
    expect(view.calls).toHaveLength(1)
    await view.settle(0)
    expect(view.calls.map(call => call.variables)).toEqual([
      { ...INITIAL, email: true },
      { ...INITIAL, email: false, digest: true },
    ])
    await view.settle(1)
    expect(view.calls).toHaveLength(2)
  })

  it('rolls back a failed save, raises an error toast and offers a retry', async () => {
    const view = active = setup()
    await view.mount()
    await view.click(view.input('Email'))
    expect(view.input('Email').checked).toBe(true)
    await view.settle(0, 'reject')
    expect(view.input('Email').checked).toBe(false)
    expect(view.toast.open).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }))
    expect(view.status()).toContain('Save failed')

    const retry = [...view.container.querySelectorAll('button')].find(button => button.textContent === 'Retry')!
    await view.click(retry)
    expect(view.input('Email').checked).toBe(true)
    expect(view.calls.map(call => call.variables.email)).toEqual([true, true])
    await view.settle(1)
    expect(view.status()).toContain('Saved')
  })

  it('only guards leaving while a save runs or an invalid edit is held', async () => {
    const view = active = setup()
    await view.mount()
    await view.click(view.input('Email'))
    await view.settle(0)
    await view.type('Name', 'A')
    await view.blur('Name')
    await view.click(view.query<HTMLAnchorElement>('a'))
    expect(view.dialog()).not.toBeNull()
    expect(view.router.state.location.pathname).toBe('/')
  })

  it('lets a settled auto card navigate away freely', async () => {
    const view = active = setup()
    await view.mount()
    await view.click(view.input('Email'))
    await view.settle(0)
    await view.click(view.query<HTMLAnchorElement>('a'))
    expect(view.dialog()).toBeNull()
    expect(view.router.state.location.pathname).toBe('/elsewhere')
  })
})

describe('lumiSettingsForm manual save', () => {
  it('keeps Discard and Save in the footer and waits for Save', async () => {
    const view = active = setup('manual')
    await view.mount()
    const buttons = (): HTMLButtonElement[] => [...view.query('.lumi-settings-row__actions').querySelectorAll('button')]
    expect(buttons().map(button => [button.textContent, button.disabled])).toEqual([['Discard', true], ['Save', true]])
    await view.click(view.input('Email'))
    expect(view.calls).toHaveLength(0)
    expect(buttons().every(button => !button.disabled)).toBe(true)

    await view.click(view.query<HTMLAnchorElement>('a'))
    expect(view.dialog()).not.toBeNull()
  })

  it('saves on submit', async () => {
    const view = active = setup('manual')
    await view.mount()
    await view.click(view.input('Email'))
    await view.click(view.query<HTMLButtonElement>('button[type="submit"]'))
    expect(view.calls.map(call => call.variables)).toEqual([{ ...INITIAL, email: true }])
    await view.settle(0)
    expect(view.query('.lumi-settings-row__actions').textContent).toContain('Changes saved')
  })
})
