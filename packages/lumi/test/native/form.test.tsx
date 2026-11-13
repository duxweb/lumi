// @vitest-environment jsdom
import type {
  DataProvider,
  FormDraftOptions,
  FormGroupDefinition,
  FormValidationIssue,
} from '@duxweb/lumi'
import type { UseFormReturn } from '../../src/react/form.js'
import { createLumi } from '@duxweb/lumi'
import { QueryClient } from '@tanstack/react-query'
import {
  act,
  startTransition,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { LumiProvider, useForm } from '../../src/react/index.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

interface Product {
  name: string
  nested?: { enabled: boolean, labels?: string[] }
}

const registry = {}

async function mountForm(options: {
  initialValues?: Partial<Product>
  id?: number
  create?: DataProvider['create']
  validate?: (values: Product) => boolean
  issues?: (values: Product) => FormValidationIssue[]
  groups?: Record<string, FormGroupDefinition>
  draft?: FormDraftOptions<Product>
}) {
  const create
    = options.create
      ?? vi.fn(async ({ variables }) => ({ data: variables as Product }))
  const provider = {
    getList: async () => ({ data: [], total: 0 }),
    getOne: async () => ({ data: {} }),
    create,
    update: create,
    deleteOne: async () => ({ data: {} }),
  } as unknown as DataProvider
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  let form!: UseFormReturn<Product>

  function Probe(props: {
    initialValues?: Partial<Product>
    id?: number
  }): null {
    form = useForm<Product>({
      resource: 'products',
      id: props.id,
      initialValues: props.initialValues,
      rules: options.validate || options.issues ? {} : undefined,
      groups: options.groups,
      draft: options.draft,
    })
    return null
  }

  const container = document.createElement('div')
  const root = createRoot(container)
  const render = async (props: {
    initialValues?: Partial<Product>
    id?: number
  }) => {
    await act(async () =>
      root.render(
        <LumiProvider
          context={createLumi({
            dataProvider: provider,
            validator:
              options.validate || options.issues
                ? {
                    validate: (_rules, values) =>
                      options.issues?.(values as Product)
                      ?? (options.validate?.(values as Product)
                        ? [
                            {
                              path: 'name',
                              code: 'invalid',
                              message: 'Name is invalid',
                            },
                          ]
                        : []),
                  }
                : undefined,
          })}
          registry={registry}
          queryClient={queryClient}
        >
          <Probe {...props} />
        </LumiProvider>,
      ),
    )
  }
  await render(options)
  return {
    get form() {
      return form
    },
    render,
    root,
    create,
  }
}

describe('useForm dirty baseline', () => {
  it('tracks JSON-like changes independent of object key order and rebuilds on reset', async () => {
    const mounted = await mountForm({
      initialValues: {
        name: 'Lumi',
        nested: { enabled: true, labels: ['one'] },
      },
    })
    expect(mounted.form.isDirty).toBe(false)

    await act(async () =>
      mounted.form.setValues({
        nested: { labels: ['one'], enabled: true },
        name: 'Lumi',
      }),
    )
    expect(mounted.form.isDirty).toBe(false)

    await act(async () => mounted.form.setValue('nested.enabled', false))
    expect(mounted.form.isDirty).toBe(true)

    await act(async () => mounted.form.reset({ name: 'Reset' }))
    expect(mounted.form.values.name).toBe('Reset')
    expect(mounted.form.isDirty).toBe(false)
    await act(async () => mounted.root.unmount())
  })

  it('rebuilds values and baseline when the initial values or target changes', async () => {
    const mounted = await mountForm({
      id: 1,
      initialValues: { name: 'First' },
    })
    await act(async () => mounted.form.setValue('name', 'Edited'))
    expect(mounted.form.isDirty).toBe(true)

    await mounted.render({ id: 2, initialValues: { name: 'Second' } })
    expect(mounted.form.values).toEqual({ name: 'Second' })
    expect(mounted.form.isDirty).toBe(false)
    await act(async () => mounted.root.unmount())
  })

  it('submits the rebuilt values when the target changes in the same commit', async () => {
    const save = vi.fn(async ({ variables }) => ({
      data: variables as Product,
    })) as unknown as DataProvider['update']
    const provider = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: {} }),
      create: save,
      update: save,
      deleteOne: async () => ({ data: {} }),
    } as DataProvider
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    let selectSecond!: () => void
    let currentForm!: UseFormReturn<Product>

    function SubmitChangedTarget({
      form,
      id,
    }: {
      form: UseFormReturn<Product>
      id: number
    }): null {
      const submittedTarget = useRef(1)
      useLayoutEffect(() => {
        if (id !== submittedTarget.current) {
          submittedTarget.current = id
          void form.submit()
        }
      })
      return null
    }

    function Probe() {
      const [target, setTarget] = useState({
        id: 1,
        initialValues: { name: 'First' },
      })
      selectSecond = () =>
        setTarget({ id: 2, initialValues: { name: 'Second' } })
      const form = useForm<Product>({ resource: 'products', ...target })
      currentForm = form
      return <SubmitChangedTarget form={form} id={target.id} />
    }

    const root = createRoot(document.createElement('div'))
    await act(async () =>
      root.render(
        <LumiProvider
          context={createLumi({ dataProvider: provider })}
          registry={registry}
          queryClient={queryClient}
        >
          <Probe />
        </LumiProvider>,
      ),
    )
    await act(async () => selectSecond())

    await vi.waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, variables: { name: 'Second' } }),
      ),
    )
    await vi.waitFor(() => expect(currentForm.isSubmitting).toBe(false))
    await act(async () => root.unmount())
  })

  it('uses the submitted snapshot as baseline without clearing edits made while pending', async () => {
    let resolve!: (value: { data: Product }) => void
    const create = vi.fn(
      () =>
        new Promise<{ data: Product }>((done) => {
          resolve = done
        }),
    ) as unknown as DataProvider['create']
    const mounted = await mountForm({
      initialValues: { name: 'Draft' },
      create,
    })
    await act(async () => mounted.form.setValue('name', 'Submitted'))

    let submission!: Promise<unknown>
    await act(async () => {
      submission = mounted.form.submit()
      await Promise.resolve()
    })
    await act(async () => mounted.form.setValue('name', 'Edited while saving'))
    await act(async () => {
      resolve({ data: { name: 'Submitted' } })
      await submission
    })

    expect(mounted.form.values.name).toBe('Edited while saving')
    expect(mounted.form.isDirty).toBe(true)
    await act(async () => mounted.form.setValue('name', 'Submitted'))
    expect(mounted.form.isDirty).toBe(false)
    await act(async () => mounted.root.unmount())
  })

  it('normalizes nested sparse arrays in submitted JSON-like snapshots', async () => {
    const create = vi.fn(async ({ variables }) => ({
      data: variables as Product,
    })) as unknown as DataProvider['create']
    const mounted = await mountForm({
      initialValues: { name: 'Draft', nested: { enabled: true, labels: [] } },
      create,
    })
    const labels: string[] = []
    labels.length = 3
    labels[2] = 'x'
    await act(async () => mounted.form.setValue('nested.labels', labels))
    await act(async () => {
      await mounted.form.submit()
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          name: 'Draft',
          nested: { enabled: true, labels: [null, null, 'x'] },
        },
      }),
    )
    expect(mounted.form.isDirty).toBe(false)
    await act(async () => mounted.root.unmount())
  })

  it('isolates pending submission state and baseline from later form targets', async () => {
    let resolveFirst!: (value: { data: Product }) => void
    let rejectSecond!: (error: Error) => void
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ data: Product }>((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<{ data: Product }>((_resolve, reject) => {
            rejectSecond = reject
          }),
      ) as unknown as DataProvider['create']
    const mounted = await mountForm({
      id: 1,
      initialValues: { name: 'First' },
      create: save,
    })
    await act(async () => mounted.form.setValue('name', 'Submitted for A'))
    let first!: Promise<unknown>
    await act(async () => {
      first = mounted.form.submit()
      await Promise.resolve()
    })
    expect(mounted.form.isSubmitting).toBe(true)

    await mounted.render({ id: 2, initialValues: { name: 'Second' } })
    expect(mounted.form.isSubmitting).toBe(false)
    expect(mounted.form.values).toEqual({ name: 'Second' })
    await act(async () => {
      resolveFirst({ data: { name: 'Submitted for A' } })
      await first
    })
    expect(mounted.form.values).toEqual({ name: 'Second' })
    expect(mounted.form.isDirty).toBe(false)

    await act(async () => mounted.form.setValue('name', 'Submitted for B'))
    let second!: Promise<unknown>
    await act(async () => {
      second = mounted.form.submit()
      await Promise.resolve()
    })
    await mounted.render({ id: 3, initialValues: { name: 'Third' } })
    expect(mounted.form.isSubmitting).toBe(false)
    const staleFailure = expect(second).rejects.toThrow('stale failure')
    await act(async () => rejectSecond(new Error('stale failure')))
    await staleFailure
    expect(mounted.form.values).toEqual({ name: 'Third' })
    expect(mounted.form.errors).toEqual([])
    expect(mounted.form.isDirty).toBe(false)
    await act(async () => mounted.root.unmount())
  })

  it('keeps committed submission state when a suspended target render is abandoned', async () => {
    let resolveSave!: (value: { data: Product }) => void
    const save = vi.fn(
      () =>
        new Promise<{ data: Product }>((resolve) => {
          resolveSave = resolve
        }),
    ) as unknown as DataProvider['update']
    const provider = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: {} }),
      create: save,
      update: save,
      deleteOne: async () => ({ data: {} }),
    } as DataProvider
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const suspended = new Promise<void>(() => {})
    let didSuspend = false
    let committedForm!: UseFormReturn<Product>
    let renderSecond!: () => void

    function Probe({
      id,
      initialValues,
    }: {
      id: number
      initialValues: Product
    }): null {
      const form = useForm<Product>({
        resource: 'products',
        id,
        initialValues,
      })
      useLayoutEffect(() => {
        committedForm = form
      })
      if (id === 2) {
        didSuspend = true
        throw suspended
      }
      return null
    }

    function Host() {
      const [target, setTarget] = useState({
        id: 1,
        initialValues: { name: 'First' },
      })
      renderSecond = () =>
        startTransition(() =>
          setTarget({ id: 2, initialValues: { name: 'Second' } }),
        )
      return (
        <Suspense fallback={null}>
          <Probe {...target} />
        </Suspense>
      )
    }

    const root = createRoot(document.createElement('div'))
    await act(async () =>
      root.render(
        <LumiProvider
          context={createLumi({ dataProvider: provider })}
          registry={registry}
          queryClient={queryClient}
        >
          <Host />
        </LumiProvider>,
      ),
    )
    await act(async () => committedForm.setValue('name', 'Saved'))
    let submission!: Promise<unknown>
    await act(async () => {
      submission = committedForm.submit()
      await Promise.resolve()
    })
    expect(committedForm.isSubmitting).toBe(true)

    await act(async () => {
      renderSecond()
      await Promise.resolve()
    })
    expect(didSuspend).toBe(true)
    await act(async () => {
      resolveSave({ data: { name: 'Saved' } })
      await submission
    })

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, variables: { name: 'Saved' } }),
    )
    expect(committedForm.values).toEqual({ name: 'Saved' })
    expect(committedForm.isDirty).toBe(false)
    expect(committedForm.isSubmitting).toBe(false)
    await act(async () => root.unmount())
  })

  it('does not clear dirty state after validation or request failures', async () => {
    const create = vi.fn(async () => {
      throw new Error('save failed')
    }) as unknown as DataProvider['create']
    const mounted = await mountForm({
      initialValues: { name: 'Draft' },
      create,
      validate: values => values.name === 'Invalid',
    })
    await act(async () => mounted.form.setValue('name', 'Invalid'))
    let validationError: unknown
    await act(async () => {
      try {
        await mounted.form.submit()
      }
      catch (error) {
        validationError = error
      }
    })
    expect(validationError).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('form validation failed'),
      }),
    )
    expect(create).not.toHaveBeenCalled()
    expect(mounted.form.isDirty).toBe(true)
    await act(async () => mounted.form.setValue('name', 'Changed'))
    let requestError: unknown
    await act(async () => {
      try {
        await mounted.form.submit()
      }
      catch (error) {
        requestError = error
      }
    })
    expect(requestError).toEqual(new Error('save failed'))
    expect(mounted.form.isDirty).toBe(true)
    await act(async () => mounted.root.unmount())
  })

  it('groups errors, validates a field subset, and keeps final submit full-form', async () => {
    const mounted = await mountForm({
      initialValues: { name: '', nested: { enabled: false, labels: [] } },
      groups: {
        basics: { fields: ['name'] },
        details: { fields: ['nested'] },
      },
      issues: values => [
        ...(values.name
          ? []
          : [{ path: 'name', code: 'required', message: 'Name is required' }]),
        ...(values.nested?.enabled
          ? []
          : [
              {
                path: 'nested.enabled',
                code: 'required',
                message: 'Enabled is required',
              },
            ]),
      ],
    })

    let basics: FormValidationIssue[] = []
    await act(async () => {
      basics = await mounted.form.validate({ fields: ['name'] })
    })
    expect(basics.map(error => error.path)).toEqual(['name'])
    expect(mounted.form.groupErrors.basics).toMatchObject({
      count: 1,
      firstError: 'name',
    })
    expect(mounted.form.groupErrors.details).toMatchObject({ count: 0 })
    expect(mounted.form.firstError(['name'])).toBe('name')

    await act(async () => mounted.form.validate({ fields: ['nested'] }))
    expect(mounted.form.groupErrors.details).toMatchObject({
      count: 1,
      firstError: 'nested.enabled',
    })
    await act(async () => mounted.form.setValue('name', 'Lumi'))
    await act(async () => mounted.form.validate({ fields: ['name'] }))
    expect(mounted.form.groupErrors.basics).toMatchObject({ count: 0 })
    expect(mounted.form.groupErrors.details).toMatchObject({ count: 1 })

    let validationError: unknown
    await act(async () => {
      try {
        await mounted.form.submit()
      }
      catch (error) {
        validationError = error
      }
    })
    expect(validationError).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('form validation failed'),
      }),
    )
    expect(mounted.create).not.toHaveBeenCalled()
    await act(async () => mounted.root.unmount())
  })

  it('saves, restores, and clears drafts without replacing the server baseline', async () => {
    const values = new Map<string, Product>()
    const store = {
      get: (key: string) => values.get(key),
      set: (key: string, value: Product) => values.set(key, value),
      delete: (key: string) => values.delete(key),
      has: (key: string) => values.has(key),
    }
    const mounted = await mountForm({
      initialValues: { name: 'Server', nested: { enabled: true } },
      draft: { key: 'product:new', store },
    })

    await act(async () => mounted.form.setValue('name', 'Draft'))
    await act(async () => expect(mounted.form.draft?.save()).toBe(true))
    expect(mounted.form.draft?.has).toBe(true)
    await act(async () => mounted.form.reset())
    expect(mounted.form.values.name).toBe('Server')
    await act(async () => expect(mounted.form.draft?.restore()).toBe(true))
    expect(mounted.form.values.name).toBe('Draft')
    expect(mounted.form.isDirty).toBe(true)
    await act(async () => expect(mounted.form.draft?.clear()).toBe(true))
    expect(mounted.form.draft?.has).toBe(false)
    await act(async () => mounted.root.unmount())
  })

  it('prevents concurrent saves for the same form', async () => {
    let resolve!: (value: { data: Product }) => void
    const save = vi.fn(
      () =>
        new Promise<{ data: Product }>((done) => {
          resolve = done
        }),
    ) as unknown as DataProvider['create']
    const mounted = await mountForm({
      initialValues: { name: 'First' },
      create: save,
    })
    let pending!: Promise<unknown>
    await act(async () => {
      pending = mounted.form.submit()
      await Promise.resolve()
    })
    await act(async () => mounted.form.setValue('name', 'Second'))
    await expect(mounted.form.submit()).rejects.toThrow('already submitting')
    expect(save).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolve({ data: { name: 'First' } })
      await pending
    })
    expect(mounted.form.isDirty).toBe(true)
    await act(async () => mounted.root.unmount())
  })
})

describe('useForm on state the page declared', () => {
  async function mountOnDeclaredState() {
    const provider = {
      getList: async () => ({ data: [], total: 0 }),
      getOne: async () => ({ data: {} }),
      create: async () => ({ data: {} }),
      update: async () => ({ data: {} }),
      deleteOne: async () => ({ data: {} }),
    } as unknown as DataProvider
    const context = createLumi({ dataProvider: provider })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let form!: UseFormReturn<Product>
    function Probe(props: { record?: Product }): null {
      form = useForm<Product>({ resource: 'products', id: 7, valuesPath: '/form', initialValues: props.record })
      return null
    }
    const root = createRoot(document.createElement('div'))
    // What a Spec's `state` gives the page before any record has loaded.
    const render = (record?: Product) => act(async () => root.render(
      <LumiProvider context={context} registry={registry} queryClient={queryClient} initialState={{ form: { name: '' } }}>
        <Probe record={record} />
      </LumiProvider>,
    ))
    await render()
    return {
      render,
      get form() {
        return form
      },
    }
  }

  it('fills the form with a record that loads after the first render', async () => {
    const mounted = await mountOnDeclaredState()
    expect(mounted.form.values).toEqual({ name: '' })
    await mounted.render({ name: 'Loaded lamp' })
    expect(mounted.form.values).toEqual({ name: 'Loaded lamp' })
    expect(mounted.form.isDirty).toBe(false)
  })

  it('keeps what the reader typed before the record arrived', async () => {
    const mounted = await mountOnDeclaredState()
    await act(async () => mounted.form.setValue('name', 'Typed first'))
    await mounted.render({ name: 'Loaded lamp' })
    expect(mounted.form.values).toEqual({ name: 'Typed first' })
  })
})

describe('useForm callbacks kept from another record', () => {
  it('leave the record now being edited alone', async () => {
    const mounted = await mountForm({ id: 1, initialValues: { name: 'One' } })
    const first = mounted.form
    await mounted.render({ id: 2, initialValues: { name: 'Two' } })
    await act(async () => mounted.form.setValue('name', 'Two edited'))
    // An upload finishing, or a save going on after an await, for record 1.
    await act(async () => first.setValue('name', 'Late for one'))
    expect(mounted.form.values).toEqual({ name: 'Two edited' })
    await expect(first.submit()).rejects.toThrow('another record')
    expect(mounted.create).not.toHaveBeenCalled()
    expect(mounted.form.values).toEqual({ name: 'Two edited' })
  })
})
