import type { OptionsSource } from '@duxweb/lumi'
import type { AgentContextItem, AgentMentionPickerProps, AgentPromptMentions, PromptMentionPickerProps } from '@duxweb/lumi-ui'
import type { BaseComponentProps } from '@json-render/react'
import type { ReactElement, ReactNode } from 'react'
import { useSelect } from '@duxweb/lumi'
import { LumiAgentMentionPicker, useBoundOrLocal } from '@duxweb/lumi-ui'
import { useLayoutEffect, useRef, useState } from 'react'

type PickerProps = AgentMentionPickerProps & { sources?: Record<string, OptionsSource> }

/**
 * Each remote tab mounts a fresh picker, which drops the focused search; when
 * the reader was in the picker, focus goes back to the new search so the
 * keyboard keeps working across tabs.
 */
function KeepFocus({ tab, children }: { tab: string | undefined, children: ReactNode }): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const inside = useRef(false)
  useLayoutEffect(() => {
    const node = host.current
    if (inside.current && node && !node.contains(document.activeElement))
      node.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
  }, [tab])
  return (
    <div
      ref={host}
      style={{ display: 'contents' }}
      onFocus={() => { inside.current = true }}
      onBlur={(event) => {
        // A search removed with its tab blurs with nowhere to go; that keeps the flag.
        if (event.relatedTarget && !host.current?.contains(event.relatedTarget as Node))
          inside.current = false
      }}
    >
      {children}
    </div>
  )
}

/** Searches and pages the active tab's resource through the DataProvider. */
function RemotePicker({ props, source, type, query, value, onType, onQuery, onValue, emit }: {
  props: PickerProps
  source: OptionsSource
  type: string | undefined
  query: string
  value: AgentContextItem[]
  onType: (type: string) => void
  onQuery: (query: string) => void
  onValue: (value: AgentContextItem[]) => void
  emit: (event: string) => void
}): ReactElement {
  const { sources: _sources, ...rest } = props
  // Mention tabs do not follow other fields, so the dependency settings stay out.
  const { dependsOn: _dependsOn, clearOnDependencyChange: _clear, ...options } = source
  const select = useSelect({ ...options, search: query })
  return (
    <LumiAgentMentionPicker
      {...rest}
      remote
      type={type}
      query={query}
      value={value}
      options={select.options.map(option => ({ ...option, value: typeof option.value === 'boolean' ? String(option.value) : option.value, ...(type ? { type } : {}) }))}
      loading={select.loading}
      loadingMore={select.loadingMore}
      hasMore={select.hasMore}
      onTypeChange={onType}
      onQueryChange={(next) => {
        onQuery(next)
        select.search(next)
        emit('search')
      }}
      onLoadMore={select.loadMore}
      onChange={(next) => {
        onValue(next)
        emit('change')
      }}
      onSelect={() => emit('select')}
    />
  )
}

/** The composer's @ references with `sources`: what PromptInput, `useAgentConversation` and AgentWorkspace pick from. */
export type AdminPromptMentions = AgentPromptMentions & { sources?: Record<string, OptionsSource> }

/**
 * The @ picker a composer opens, searching `mentions.sources` through the
 * DataProvider: one resource per tab, a tab without a source keeping the
 * static `options`. Hand it to PromptInput as `mentionPicker`.
 */
export function AdminPromptMentionPicker({ mentions, value, onChange }: PromptMentionPickerProps): ReactElement {
  const { sources, ...rest } = mentions as AdminPromptMentions
  const [type, setType] = useState<string | undefined>()
  const [query, setQuery] = useState('')
  const active = type ?? rest.types?.[0]?.value
  const source = active ? sources?.[active] : undefined
  const props: PickerProps = { ...rest, multiple: true, maxHeight: 280 }
  return (
    <KeepFocus tab={active}>
      {source
        ? <RemotePicker key={active} props={props} source={source} type={active} query={query} value={value} onType={setType} onQuery={setQuery} onValue={onChange} emit={() => {}} />
        : <LumiAgentMentionPicker {...props} type={active} query={query} value={value} onTypeChange={setType} onQueryChange={setQuery} onChange={onChange} />}
    </KeepFocus>
  )
}

/**
 * The @ picker with `sources`: one DataProvider resource per tab, keyed by the
 * tab's `value`. A tab without a source keeps the static `options`.
 */
export function AgentMentionPickerBody({ props, bindings, emit }: BaseComponentProps<PickerProps>): ReactElement {
  const [type, setType] = useBoundOrLocal(props.type, bindings?.type)
  const [query, setQuery] = useBoundOrLocal(props.query, bindings?.query)
  const [value, setValue] = useBoundOrLocal(props.value, bindings?.value)
  const active = type ?? props.types?.[0]?.value
  const source = active ? props.sources?.[active] : undefined
  if (source) {
    // Keyed by tab, so switching kinds starts a fresh search of the new resource.
    return (
      <KeepFocus tab={active}>
        <RemotePicker key={active} props={props} source={source} type={active} query={query ?? ''} value={value ?? []} onType={setType} onQuery={setQuery} onValue={setValue} emit={emit} />
      </KeepFocus>
    )
  }
  const { sources: _sources, ...rest } = props
  return (
    <LumiAgentMentionPicker
      {...rest}
      type={active}
      query={query ?? ''}
      value={value ?? []}
      onTypeChange={setType}
      onQueryChange={(next) => {
        setQuery(next)
        emit('search')
      }}
      onChange={(next) => {
        setValue(next)
        emit('change')
      }}
      onSelect={() => emit('select')}
    />
  )
}
