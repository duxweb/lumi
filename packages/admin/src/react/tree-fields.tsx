import type { TreeSource } from '@duxweb/lumi'
import type { CascaderOption, OptionValue } from '@duxweb/lumi-ui'
import type { ValidationCheck } from '@json-render/core'
import type { BaseComponentProps } from '@json-render/react'
import type { ReactElement } from 'react'
import type { LumiRecordPickerProps } from './pages/LumiRecordPicker.js'
import { useTreeSource } from '@duxweb/lumi'
import { treeSourceSchema } from '@duxweb/lumi/catalog'
import { useBoundProp, useFieldValidation } from '@json-render/react'
import { useMemo } from 'react'
import { LumiRecordPicker } from './pages/LumiRecordPicker.js'
import { LumiTreeFilter } from './pages/LumiTreeFilter.js'

type TreeFilterContext = BaseComponentProps<{ source?: TreeSource, items?: CascaderOption[], value?: OptionValue | null, subtree?: OptionValue[] | null } & Record<string, unknown>>

function TreeFilterView({ context, items, loading, onLoadChildren, onSearch }: { context: TreeFilterContext } & Pick<Parameters<typeof LumiTreeFilter>[0], 'items' | 'loading' | 'onLoadChildren' | 'onSearch'>): ReactElement {
  const { props, bindings, emit } = context
  const { source: _source, items: _items, value: _value, subtree: _subtree, ...rest } = props
  const [value, setValue] = useBoundProp(props.value, bindings?.value)
  const [, setSubtree] = useBoundProp(props.subtree, bindings?.subtree)
  return (
    <LumiTreeFilter
      {...rest}
      items={items}
      value={value ?? null}
      loading={Boolean(props.loading) || loading}
      onLoadChildren={onLoadChildren}
      onSearch={onSearch}
      onChange={(next) => {
        setValue(next)
        if (!bindings?.subtree)
          emit('change')
      }}
      onSubtreeChange={bindings?.subtree
        ? (next) => {
            setSubtree(next)
            emit('change')
          }
        : undefined}
    />
  )
}

function RemoteTreeFilter({ context }: { context: TreeFilterContext }): ReactElement {
  const source = useMemo(() => treeSourceSchema.parse(context.props.source), [context.props.source])
  const [value] = useBoundProp(context.props.value, context.bindings?.value)
  const tree = useTreeSource(source, { value })
  return <TreeFilterView context={context} items={tree.items} loading={tree.loading} onLoadChildren={tree.loadChildren} onSearch={tree.search} />
}

export function TreeFilterBody(context: BaseComponentProps): ReactElement {
  const typed = context as TreeFilterContext
  return typed.props.source
    ? <RemoteTreeFilter context={typed} />
    : <TreeFilterView context={typed} items={typed.props.items ?? []} />
}

export function RecordPickerBody({ props, bindings, emit }: BaseComponentProps): ReactElement {
  const { checks, value: initial, ...rest } = props as unknown as LumiRecordPickerProps & { checks?: ValidationCheck[] }
  const [value, setValue] = useBoundProp<LumiRecordPickerProps['value']>(initial, bindings?.value)
  const config = useMemo(() => (checks ? { checks } : undefined), [checks])
  const validation = useFieldValidation(bindings?.value ?? '', config)
  return (
    <LumiRecordPicker
      {...rest}
      value={value ?? null}
      invalid={Boolean(rest.invalid) || !validation.isValid}
      onChange={(next) => {
        setValue(next)
        emit('change')
      }}
    />
  )
}
