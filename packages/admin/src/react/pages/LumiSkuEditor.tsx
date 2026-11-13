import type { RepeaterColumnAction } from '@duxweb/lumi-ui'
import type { ReactElement } from 'react'
import type { SkuAttribute, SkuValue, SkuVariant } from './skuMatrix.js'
import { LumiButton, LumiFieldErrorTip, LumiInput, LumiNumberInput, LumiRepeater, LumiRepeaterRow, LumiSelect, LumiTagsInput, useUiText } from '@duxweb/lumi-ui'
import { Fragment, useId } from 'react'
import { buildSkuVariants } from './skuMatrix.js'

type CellValue = string | number | null

/** One editable column of the combination matrix; the variant stores its value under `key`. */
export interface SkuColumn {
  key: string
  /** Falls back to the built-in label for `price`, `stock` and `sku`, else the key. */
  label?: string | undefined
  kind: 'number' | 'currency' | 'text' | 'select'
  required?: boolean | undefined
  width?: number | string | undefined
  /** Currency columns default to the editor's `pricePrefix`. */
  prefix?: string | undefined
  suffix?: string | undefined
  /** Currency columns default to the editor's `precision`. */
  precision?: number | undefined
  min?: number | undefined
  max?: number | undefined
  placeholder?: string | undefined
  options?: Array<{ value: string | number, label: string }> | undefined
  /** Value of a newly generated combination that inherits nothing for this column. */
  defaultValue?: CellValue | undefined
  /** Offer "apply first row to all" in the header; on by default except for text columns such as codes. */
  fill?: boolean | undefined
}

/** Per-instance wording; `{count}` and `{name}` are filled in where noted. */
export interface SkuEditorLabels {
  title?: string | undefined
  /** `{count}` */
  count?: string | undefined
  empty?: string | undefined
  /** Tooltip of a column's "apply first row to all" button. */
  fill?: string | undefined
  /** `{count}`: announced after a fill. */
  filled?: string | undefined
  attributes?: string | undefined
  attributeName?: string | undefined
  attributeNamePlaceholder?: string | undefined
  valuesPlaceholder?: string | undefined
  /** `{name}` */
  attributeValues?: string | undefined
  addAttribute?: string | undefined
  /** `{name}` */
  removeAttribute?: string | undefined
}

export interface LumiSkuEditorProps {
  value?: Partial<SkuValue> | undefined
  onChange?: ((value: SkuValue) => void) | undefined
  /** Field errors such as submitForm's `fieldErrors`. */
  errors?: Record<string, string> | undefined
  onErrorsChange?: ((errors: Record<string, string>) => void) | undefined
  /** Error path of the bound value, e.g. `sku`: rows read `sku.variants.2.price`. */
  name?: string | undefined
  /** Matrix columns; defaults to price (currency), stock (number) and sku (text). */
  columns?: SkuColumn[] | undefined
  labels?: SkuEditorLabels | undefined
  /** `tooltip` (default) keeps the matrix rows one height; `inline` writes errors under the controls. */
  errorDisplay?: 'inline' | 'tooltip' | undefined
  maxAttributes?: number | undefined
  pricePrefix?: string | undefined
  precision?: number | undefined
  disabled?: boolean | undefined
  readonly?: boolean | undefined
  ariaLabel?: string | undefined
  className?: string | undefined
}

const EMPTY: SkuAttribute[] = []

const DEFAULT_COLUMNS: SkuColumn[] = [
  { key: 'price', kind: 'currency', required: true, width: 160, min: 0 },
  { key: 'stock', kind: 'number', required: true, width: 128, precision: 0, min: 0 },
  { key: 'sku', kind: 'text', width: 180 },
]

const BUILT_IN_LABELS: Record<string, [message: string, fallback: string]> = {
  price: ['lumi.sku.price', 'Price'],
  stock: ['lumi.sku.stock', 'Stock'],
  sku: ['lumi.sku.code', 'Code'],
}

const filled = (value: unknown): boolean => value !== null && value !== undefined && value !== ''

function fill(template: string, params: Record<string, string | number> = {}): string {
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)
}

/**
 * Specifications on top, the combination matrix below. Editing the specifications
 * regenerates the matrix and keeps what was typed for combinations that remain.
 */
export function LumiSkuEditor(props: LumiSkuEditorProps): ReactElement {
  const { t } = useUiText()
  const { value, onChange, errors, onErrorsChange, name, columns: columnsProp, labels, errorDisplay = 'tooltip', maxAttributes = 3, pricePrefix, precision = 2, disabled, readonly, ariaLabel, className } = props
  const attributes = value?.attributes ?? EMPTY
  const variants = value?.variants ?? []
  const locked = Boolean(disabled || readonly)
  const tipId = useId()
  const path = (suffix: string): string | undefined => name ? `${name}.${suffix}` : undefined
  const text = (key: keyof SkuEditorLabels, message: string, fallback: string, params?: Record<string, string | number>): string =>
    labels?.[key] === undefined ? t(message, fallback, params) : fill(labels[key], params)

  const columns = (columnsProp ?? DEFAULT_COLUMNS).map((column) => {
    const builtIn = BUILT_IN_LABELS[column.key]
    return {
      ...column,
      label: column.label ?? (builtIn ? t(builtIn[0], builtIn[1]) : column.key),
      ...(column.kind === 'currency' ? { prefix: column.prefix ?? pricePrefix, precision: column.precision ?? precision } : {}),
    }
  })
  const defaults = Object.fromEntries(columns.map(column => [column.key, column.defaultValue ?? null]))

  const setAttributes = (next: SkuAttribute[]): void => {
    const nextVariants = buildSkuVariants(next, variants, defaults)
    const variantsPrefix = path('variants.')
    // Regenerated rows are re-indexed, so a variant error would land on the wrong row.
    const keysChanged = nextVariants.length !== variants.length || nextVariants.some((variant, index) => variant.key !== variants[index]?.key)
    if (keysChanged && variantsPrefix && errors && onErrorsChange && Object.keys(errors).some(key => key.startsWith(variantsPrefix)))
      onErrorsChange(Object.fromEntries(Object.entries(errors).filter(([key]) => !key.startsWith(variantsPrefix))))
    onChange?.({ attributes: next, variants: nextVariants })
  }
  const setVariants = (next: SkuVariant[]): void => onChange?.({ attributes, variants: next })
  const patchVariant = (index: number, field: string, fieldValue: unknown): void =>
    setVariants(variants.map((variant, itemIndex) => itemIndex === index ? { ...variant, [field]: fieldValue } : variant))
  const patchAttribute = (index: number, next: Partial<SkuAttribute>): void =>
    setAttributes(attributes.map((attribute, itemIndex) => itemIndex === index ? { ...attribute, ...next } : attribute))
  const fillLabel = text('fill', 'lumi.sku.fill', 'Apply first row to all')
  const columnActions = Object.fromEntries(columns.filter(column => column.fill ?? column.kind !== 'text').map((column) => {
    const first = variants[0]?.[column.key]
    const action: RepeaterColumnAction = {
      label: fillLabel,
      ariaLabel: `${column.label}: ${fillLabel}`,
      icon: 'arrow-down-to-line',
      disabled: variants.length < 2 || !filled(first),
      onSelect: () => {
        setVariants(variants.map(variant => ({ ...variant, [column.key]: first })))
        return text('filled', 'lumi.sku.filled', 'Applied to {count} rows', { count: variants.length })
      },
    }
    return [column.key, action]
  }))

  const control = (column: typeof columns[number], current: unknown, onValue: (next: CellValue) => void, label: string): ReactElement => {
    const shared = { ariaLabel: label, disabled, readonly, placeholder: column.placeholder }
    if (column.kind === 'select')
      return <LumiSelect {...shared} value={typeof current === 'string' || typeof current === 'number' ? current : null} options={column.options ?? []} onChange={next => onValue(next === null || typeof next === 'boolean' ? null : next)} />
    if (column.kind === 'text')
      return <LumiInput {...shared} value={filled(current) ? String(current) : ''} onChange={onValue} />
    return <LumiNumberInput {...shared} value={typeof current === 'number' ? current : null} prefix={column.prefix} suffix={column.suffix} precision={column.precision} min={column.min} max={column.max} onChange={onValue} />
  }

  const optionNames = [...new Set(variants.flatMap(variant => Object.keys(variant.options ?? {})))]
  const matrixColumns = [
    ...optionNames.map(option => ({ key: `option:${option}`, label: option })),
    ...columns.map(column => ({ key: column.key, label: column.label, width: column.width, required: column.required })),
  ]
  const title = text('title', 'lumi.sku.variants', 'Combinations')

  return (
    <div className={className} data-slot="sku-editor" role="group" aria-label={ariaLabel}>
      <section data-slot="sku-attributes" aria-labelledby={`${tipId}-attributes`}>
        <header data-slot="sku-section-header">
          <span id={`${tipId}-attributes`} data-slot="sku-section-title">{text('attributes', 'lumi.sku.attributes', 'Specifications')}</span>
          {!locked && attributes.length < maxAttributes && (
            <LumiButton
              appearance="outline"
              size="sm"
              icon="plus"
              label={text('addAttribute', 'lumi.sku.addAttribute', 'Add specification')}
              onClick={() => setAttributes([...attributes, { name: '', values: [] }])}
            />
          )}
        </header>
        {attributes.map((attribute, index) => {
          const nameLabel = text('attributeName', 'lumi.sku.attributeName', 'Specification name')
          const label = attribute.name || nameLabel
          const nameError = path(`attributes.${index}.name`) && errors?.[path(`attributes.${index}.name`)!]
          const nameInput = (
            <LumiInput
              value={attribute.name}
              placeholder={text('attributeNamePlaceholder', 'lumi.sku.attributeNamePlaceholder', 'e.g. Color')}
              ariaLabel={nameLabel}
              invalid={Boolean(nameError)}
              disabled={disabled}
              readonly={readonly}
              onChange={next => patchAttribute(index, { name: next })}
            />
          )
          return (
            <div key={index} data-slot="sku-attribute">
              <div data-slot="sku-attribute-name">
                {errorDisplay === 'tooltip'
                  ? <LumiFieldErrorTip id={`${tipId}-name-${index}`} message={nameError || undefined} describe>{nameInput}</LumiFieldErrorTip>
                  : nameInput}
                {nameError && errorDisplay === 'inline' && <span role="alert" data-slot="sku-error">{nameError}</span>}
              </div>
              <LumiTagsInput
                value={attribute.values}
                placeholder={text('valuesPlaceholder', 'lumi.sku.valuesPlaceholder', 'Type a value, press Enter')}
                ariaLabel={text('attributeValues', 'lumi.sku.attributeValues', 'Values of {name}', { name: label })}
                disabled={disabled}
                readonly={readonly}
                onChange={next => patchAttribute(index, { values: next })}
              />
              {!locked && (
                <LumiButton
                  appearance="ghost"
                  shape="square"
                  size="md"
                  icon="x"
                  label={text('removeAttribute', 'lumi.sku.removeAttribute', 'Remove specification {name}', { name: label })}
                  onClick={() => setAttributes(attributes.filter((_, itemIndex) => itemIndex !== index))}
                />
              )}
            </div>
          )
        })}
      </section>

      <section data-slot="sku-variants" aria-label={title}>
        <header data-slot="sku-section-header">
          <span data-slot="sku-section-title">
            {title}
            <span data-slot="sku-variants-count">{text('count', 'lumi.sku.variantCount', '{count} combinations', { count: variants.length })}</span>
          </span>
        </header>
        {variants.length
          ? (
              <LumiRepeater
                value={variants}
                columns={matrixColumns}
                columnActions={columnActions}
                sortable={false}
                addable={false}
                removable={false}
                duplicable={false}
                errors={errors}
                onErrorsChange={onErrorsChange}
                name={path('variants')}
                errorDisplay={errorDisplay}
                disabled={disabled}
                readonly={readonly}
                onChange={next => setVariants(next as SkuVariant[])}
              >
                {variants.map((variant, index) => {
                  const label = Object.values(variant.options ?? {}).join(' / ')
                  return (
                    <LumiRepeaterRow key={variant.key} index={index}>
                      {optionNames.map(option => <span key={option} data-slot="sku-option">{variant.options?.[option] ?? '—'}</span>)}
                      {columns.map(column => (
                        <Fragment key={column.key}>
                          {control(column, variant[column.key], next => patchVariant(index, column.key, next), `${label} ${column.label}`)}
                        </Fragment>
                      ))}
                    </LumiRepeaterRow>
                  )
                })}
              </LumiRepeater>
            )
          : <p data-slot="sku-empty">{text('empty', 'lumi.sku.empty', 'Add a specification with at least one value to generate combinations.')}</p>}
      </section>
    </div>
  )
}
