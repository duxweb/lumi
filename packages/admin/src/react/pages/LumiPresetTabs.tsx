import type { FilterModel, NamedFilterPreset } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import { useUiText } from '@duxweb/lumi-ui'
import { filterConditionsToModel } from '@duxweb/lumi-ui/catalog'

export interface LumiPresetTabsProps {
  presets: readonly NamedFilterPreset[]
  /** The filter model currently driving the table, used to mark the active preset. */
  value: FilterModel
  onChange: (value: FilterModel) => void
  /** Leading tab that clears the filters, e.g. `All`. */
  allLabel?: string
  /** Rows behind the `All` tab. Each preset carries its own `count`. */
  allCount?: number
  className?: string
}

/** Set-equality over the meaningful entries; key order must not decide the tab. */
function sameModel(left: FilterModel, right: FilterModel): boolean {
  const key = (model: FilterModel): string => JSON.stringify(
    Object.entries(model)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b)),
  )
  return key(left) === key(right)
}

/** Saved views lead the result surface while filters own a separate panel. */
export function LumiPresetTabs(props: LumiPresetTabsProps): ReactElement {
  const { t } = useUiText()
  const { presets, value, onChange, allLabel = t('lumi.common.all', 'All'), allCount, className } = props
  const models = presets.map(preset => filterConditionsToModel(preset.conditions))
  const activeIndex = models.findIndex(model => sameModel(model, value))
  return (
    <div className={['lumi-preset-tabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={t('lumi.list.savedViews', 'Saved views')}>
      <button type="button" role="tab" aria-selected={activeIndex === -1} data-active={activeIndex === -1 || undefined} onClick={() => onChange({})}>
        {allLabel}
        {allCount !== undefined && <span className="lumi-preset-tabs__count">{allCount.toLocaleString()}</span>}
      </button>
      {presets.map((preset, index) => (
        <button
          key={preset.name}
          type="button"
          role="tab"
          aria-selected={index === activeIndex}
          data-active={index === activeIndex || undefined}
          onClick={() => onChange(filterConditionsToModel(preset.conditions))}
        >
          {preset.label}
          {preset.count !== undefined && <span className="lumi-preset-tabs__count">{preset.count.toLocaleString()}</span>}
        </button>
      ))}
    </div>
  )
}
