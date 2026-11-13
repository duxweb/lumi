import type { ValidationCheck } from '@json-render/core'
import type { BaseComponentProps } from '@json-render/react'
import type { ComponentType, ReactElement } from 'react'
import type { OptionsSource } from '../catalog/options.js'
import type { ID } from '../core/index.js'
import { useBoundProp, useFieldValidation, useStateStore } from '@json-render/react'
import { useEffect, useMemo, useRef } from 'react'
import { optionsSourceSchema } from '../catalog/options.js'
import { useSelect } from './select.js'

export type { OptionsSource } from '../catalog/options.js'

export interface ConnectOptionsConfig {
  /** Shape of the bound value: one option value, a list of them, or free text that only takes suggestions. */
  mode?: 'single' | 'multiple' | 'text'
  /** Host callback prop → catalog event it emits, beyond `change`. */
  events?: Record<string, string>
}

type Mode = NonNullable<ConnectOptionsConfig['mode']>

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

function emptyValue(mode: Mode): null | [] | '' {
  return mode === 'multiple' ? [] : mode === 'text' ? '' : null
}

interface BoundControl {
  rest: Record<string, unknown>
  value: unknown
  hostProps: Record<string, unknown> & { onChange: (next: unknown) => void }
}

function useBoundControl({ props, bindings, emit }: BaseComponentProps, events: Record<string, string>): BoundControl {
  const { checks, source: _source, ...rest } = props as Record<string, unknown> & { checks?: ValidationCheck[], source?: unknown }
  const [value, setValue] = useBoundProp(props.value, bindings?.value)
  const config = useMemo(() => (checks ? { checks } : undefined), [checks])
  const validation = useFieldValidation(bindings?.value ?? '', config)
  const controlled = bindings?.value !== undefined || props.value !== undefined
  const handlers = Object.fromEntries(Object.entries(events).map(([prop, event]) => [prop, () => emit(event)]))
  return {
    rest,
    value,
    hostProps: {
      ...rest,
      ...handlers,
      ...(controlled ? { value } : {}),
      invalid: Boolean(props.invalid) || !validation.isValid,
      error: props.error ?? validation.errors[0],
      onChange: (next: unknown) => {
        setValue(next)
        emit('change')
      },
    },
  }
}

interface ConnectedProps {
  context: BaseComponentProps
  Component: ComponentType<any>
  mode: Mode
  events: Record<string, string>
}

function StaticOptions({ context, Component, events }: ConnectedProps): ReactElement {
  const { hostProps } = useBoundControl(context, events)
  return <Component {...hostProps} />
}

function RemoteOptions({ context, Component, mode, events }: ConnectedProps): ReactElement {
  const { rest, value, hostProps } = useBoundControl(context, events)
  const source: OptionsSource = optionsSourceSchema.parse(context.props.source)
  const store = useStateStore()
  const dependsOn = source.dependsOn ?? {}
  const fields = Object.keys(dependsOn)
  const current = Object.fromEntries(fields.map(field => [field, store.get(dependsOn[field]!)]))
  const depKey = JSON.stringify(current)
  // Keyed by value: the store returns fresh objects on every read.
  const deps = useMemo(() => current, [depKey])
  const ready = fields.every(field => !isEmpty(deps[field]))
  const select = useSelect({
    resource: source.resource,
    dataProviderName: source.dataProviderName,
    meta: source.meta,
    filters: source.filters,
    labelField: source.labelField,
    valueField: source.valueField,
    descriptionField: source.descriptionField,
    avatarField: source.avatarField,
    imageField: source.imageField,
    searchField: source.searchField,
    pageSize: source.pageSize,
    dependsOn: fields,
    deps,
    selected: mode === 'text' ? undefined : value as ID | ID[] | null | undefined,
    enabled: ready,
  })

  // A changed parent invalidates the child's value. Filling an empty parent
  // (a record loading into the form) is not a change and keeps the child.
  const previous = useRef(deps)
  const clearOnChange = source.clearOnDependencyChange ?? true
  useEffect(() => {
    const before = previous.current
    previous.current = deps
    if (before === deps || !clearOnChange)
      return
    const changed = fields.some(field => !isEmpty(before[field]) && JSON.stringify(before[field]) !== JSON.stringify(deps[field]))
    if (changed && !isEmpty(value))
      hostProps.onChange(emptyValue(mode))
  }, [deps])

  return (
    <Component
      {...hostProps}
      options={select.options}
      selectedOptions={select.selectedOptions}
      loading={Boolean(rest.loading) || select.loading}
      loadingMore={select.loadingMore}
      hasMore={select.hasMore}
      total={select.total}
      filterable={rest.filterable ?? true}
      disabled={Boolean(rest.disabled) || !ready}
      onSearch={source.searchField ? select.search : undefined}
      onLoadMore={select.loadMore}
    />
  )
}

/**
 * Compose a native registry entry for a choice control (Select, MultiSelect,
 * AutoComplete, Mention, Transfer) whose options may come from a `source`
 * resource. Without `source` the control keeps its static `options` and needs
 * no Lumi data services.
 */
export function connectOptions(Component: ComponentType<any>, config: ConnectOptionsConfig = {}) {
  const mode = config.mode ?? 'single'
  const events = config.events ?? {}
  return function ConnectedOptions(context: BaseComponentProps): ReactElement {
    return context.props.source
      ? <RemoteOptions context={context} Component={Component} mode={mode} events={events} />
      : <StaticOptions context={context} Component={Component} mode={mode} events={events} />
  }
}
