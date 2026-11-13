import { z } from 'zod'

export const FILTER_OPERATORS = ['eq', 'in', 'contains', 'gte', 'lte', 'between'] as const
export const FILTER_WIDGETS = ['chips', 'select', 'cascader', 'dateRange', 'numberRange', 'search', 'tags'] as const

export type FilterConditionOperator = typeof FILTER_OPERATORS[number]
export type FilterWidget = typeof FILTER_WIDGETS[number]

export interface FilterCondition {
  field: string
  op: FilterConditionOperator
  value: unknown
}

export type QueryFilterOperator = 'eq' | 'in' | 'like' | 'gte' | 'lte' | 'between'

export interface QueryFilter {
  field: string
  operator: QueryFilterOperator
  value: unknown
}

export interface FilterOption {
  label: string
  value: string | number | boolean
  disabled?: boolean
  children?: FilterOption[]
}
export const filterOptionSchema: z.ZodType<FilterOption, FilterOption> = z.lazy(() => z.strictObject({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  disabled: z.boolean().optional(),
  children: z.array(filterOptionSchema).optional(),
}))
export const filterDatePresetSchema = z.strictObject({ label: z.string(), value: z.union([z.tuple([z.string(), z.string()]), z.tuple([z.number(), z.number()])]) })
export type FilterDatePreset = z.infer<typeof filterDatePresetSchema>
export const filterFieldSchema = z.strictObject({
  field: z.string(),
  label: z.string(),
  widget: z.enum(FILTER_WIDGETS),
  options: z.array(filterOptionSchema).optional(),
  presets: z.array(filterDatePresetSchema).optional(),
  placeholder: z.string().optional(),
  primary: z.boolean().optional(),
})
export type FilterFieldDef = z.infer<typeof filterFieldSchema>
export const namedFilterPresetSchema = z.strictObject({ name: z.string(), label: z.string(), count: z.number().optional(), conditions: z.array(z.strictObject({ field: z.string(), op: z.enum(FILTER_OPERATORS), value: z.unknown() })) })
export type NamedFilterPreset = z.infer<typeof namedFilterPresetSchema>
export const listFilterSchema = z.strictObject({ fields: z.array(filterFieldSchema), presets: z.array(namedFilterPresetSchema).optional() })
export type ListFilterSchema = z.infer<typeof listFilterSchema>

export type FilterModel = Record<string, unknown>

const EMPTY_VALUES = new Set([undefined, null, ''])
const FILTER_TO_QUERY_OPERATOR = {
  eq: 'eq',
  in: 'in',
  contains: 'like',
  gte: 'gte',
  lte: 'lte',
  between: 'between',
} as const satisfies Record<FilterConditionOperator, QueryFilterOperator>

function isEmptyValue(value: unknown): boolean {
  return EMPTY_VALUES.has(value as undefined | null | '') || (Array.isArray(value) && value.length === 0)
}

function widgetOperator(widget: FilterFieldDef['widget'], value: unknown): FilterConditionOperator {
  if (widget === 'search')
    return 'contains'
  if (widget === 'tags')
    return 'in'
  if (widget === 'dateRange' || widget === 'numberRange')
    return Array.isArray(value) && value.length === 2 ? 'between' : 'eq'
  return 'eq'
}

/** A copy of a filter model, its array values copied too. */
export function cloneFilterModel(model: FilterModel): FilterModel {
  return Object.fromEntries(Object.entries(model).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]))
}

/** Filter conditions as DataProvider filters; a `between` becomes a `gte` and an `lte`. */
export function filterConditionsToQueryFilters(conditions: FilterCondition[]): QueryFilter[] {
  return conditions.flatMap((condition) => {
    if (condition.op === 'between' && Array.isArray(condition.value)) {
      const [start, end] = condition.value
      const filters: QueryFilter[] = []
      if (!isEmptyValue(start))
        filters.push({ field: condition.field, operator: 'gte', value: start })
      if (!isEmptyValue(end))
        filters.push({ field: condition.field, operator: 'lte', value: end })
      return filters
    }

    return [{
      field: condition.field,
      operator: FILTER_TO_QUERY_OPERATOR[condition.op],
      value: condition.value,
    }]
  })
}

/** Another name for `filterConditionsToQueryFilters`. */
export const filterConditionsToCoreFilters = filterConditionsToQueryFilters

/** The conditions a filter bar's values stand for, by each field's widget; empty values are left out. */
export function filterModelToConditions(fields: FilterFieldDef[], model: FilterModel): FilterCondition[] {
  return fields.flatMap((field) => {
    const value = model[field.field]
    if (isEmptyValue(value))
      return []
    if ((field.widget === 'dateRange' || field.widget === 'numberRange') && Array.isArray(value)) {
      const [start, end] = value
      if (!isEmptyValue(start) && !isEmptyValue(end))
        return [{ field: field.field, op: 'between', value: [start, end] }]
      if (!isEmptyValue(start))
        return [{ field: field.field, op: 'gte', value: start }]
      if (!isEmptyValue(end))
        return [{ field: field.field, op: 'lte', value: end }]
      return []
    }

    const op = widgetOperator(field.widget, value)
    return [{
      field: field.field,
      op,
      value: op === 'between' && Array.isArray(value) ? [value[0], value[1]] : value,
    }]
  })
}

/** The filter bar values that conditions stand for; the reverse of `filterModelToConditions`. */
export function filterConditionsToModel(conditions: FilterCondition[]): FilterModel {
  const model: FilterModel = {}
  for (const condition of conditions) {
    if (condition.op === 'gte' || condition.op === 'lte') {
      const current = Array.isArray(model[condition.field]) ? model[condition.field] as unknown[] : []
      model[condition.field] = condition.op === 'gte'
        ? [condition.value, current[1]]
        : [current[0], condition.value]
      continue
    }
    model[condition.field] = Array.isArray(condition.value) ? [...condition.value] : condition.value
  }
  return model
}

/** The filter bar values that DataProvider filters stand for. */
export function queryFiltersToModel(filters: Array<{ field: string, operator: string, value: unknown }>): FilterModel {
  const model: FilterModel = {}
  for (const filter of filters) {
    if (filter.operator === 'gte') {
      const range = Array.isArray(model[filter.field]) ? model[filter.field] as unknown[] : []
      model[filter.field] = [filter.value, range[1]]
    }
    else if (filter.operator === 'lte') {
      const range = Array.isArray(model[filter.field]) ? model[filter.field] as unknown[] : []
      model[filter.field] = [range[0], filter.value]
    }
    else {
      model[filter.field] = Array.isArray(filter.value) ? [...filter.value] : filter.value
    }
  }
  return model
}

/** Whether a string is a known filter operator. */
export function isFilterOperator(value: string): value is FilterConditionOperator {
  return (FILTER_OPERATORS as readonly string[]).includes(value)
}

/** Whether a string is a known filter widget. */
export function isFilterWidget(value: string): value is FilterWidget {
  return (FILTER_WIDGETS as readonly string[]).includes(value)
}
