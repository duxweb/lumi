export type FieldType = 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'time' | 'dateRange' | 'enum' | 'enumMulti' | 'relation' | 'relationMulti' | 'file' | 'richtext' | 'json' | 'color' | 'custom'

export type WidgetType
  = | 'Input'
    | 'Textarea'
    | 'NumberInput'
    | 'Select'
    | 'MultiSelect'
    | 'Checkbox'
    | 'CheckboxGroup'
    | 'RadioGroup'
    | 'Switch'
    | 'DatePicker'
    | 'TimePicker'
    | 'DateTimePicker'
    | 'DateRangePicker'
    | 'Cascader'
    | 'Upload'
    | 'TagsInput'

export type FormLayout = 'vertical' | 'horizontal' | 'inline'

export const FIELD_TYPES = ['string', 'text', 'number', 'boolean', 'date', 'datetime', 'time', 'dateRange', 'enum', 'enumMulti', 'relation', 'relationMulti', 'file', 'richtext', 'json', 'color', 'custom'] as const satisfies readonly FieldType[]

export const WIDGET_TYPES = ['Input', 'Textarea', 'NumberInput', 'Select', 'MultiSelect', 'Checkbox', 'CheckboxGroup', 'RadioGroup', 'Switch', 'DatePicker', 'TimePicker', 'DateTimePicker', 'DateRangePicker', 'Cascader', 'Upload', 'TagsInput'] as const satisfies readonly WidgetType[]

export const DEFAULT_WIDGET_BY_FIELD_TYPE = {
  string: 'Input',
  text: 'Textarea',
  number: 'NumberInput',
  boolean: 'Switch',
  date: 'DatePicker',
  datetime: 'DateTimePicker',
  time: 'TimePicker',
  dateRange: 'DateRangePicker',
  enum: 'Select',
  enumMulti: 'MultiSelect',
  relation: 'Select',
  relationMulti: 'MultiSelect',
  file: 'Upload',
  richtext: 'Textarea',
  json: 'Textarea',
  color: 'Input',
  custom: 'Input',
} as const satisfies Record<FieldType, WidgetType>

/** Whether a string is a known field type. */
export function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value)
}

/** Whether a string is a known widget type. */
export function isWidgetType(value: string): value is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(value)
}

/** The widget a field type uses when none is named. */
export function defaultWidgetForField(type: FieldType): WidgetType {
  return DEFAULT_WIDGET_BY_FIELD_TYPE[type]
}
