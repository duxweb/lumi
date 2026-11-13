import type { ComponentType, FormEvent, ReactElement, ReactNode } from 'react'
import type { FormFieldProps, FormProps, WidgetType } from '../catalog/types-public.js'
import { useId } from 'react'
import { defaultWidgetForField } from '../catalog/types-public.js'
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../internal/shadcn/field.js'
import { LumiCascader } from './cascader.js'
import { LumiCheckbox, LumiCheckboxGroup, LumiInput, LumiMultiSelect, LumiNumberInput, LumiRadioGroup, LumiSelect, LumiSwitch, LumiTagsInput, LumiTextarea, LumiUpload } from './controls.js'
import { LumiDatePicker, LumiDateRangePicker, LumiDateTimePicker, LumiTimePicker } from './datetime.js'
import { LumiFieldErrorTip } from './field-error.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string }

export function LumiForm(props: FormProps & HostProps): ReactElement {
  const { value, defaultValue, rules, layout = 'vertical', disabled, children, onSubmit, ...rest } = props
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const submitted = Object.fromEntries(new FormData(event.currentTarget))
    onSubmit?.(value ?? { ...(defaultValue ?? {}), ...submitted })
  }
  // Validation belongs to native field checks and business rules, which render
  // their own accessible errors; the browser's constraint bubbles would block
  // submit before they run. Fields fill the column; a submit button keeps its
  // own width, as it does in a Card or a vertical Stack.
  return <form {...rest} noValidate data-layout={layout} aria-disabled={disabled} onSubmit={submit}><fieldset className="contents" disabled={disabled}><FieldGroup className="[&>[data-slot=button]]:self-start">{children}</FieldGroup></fieldset></form>
}

const widgets = {
  Input: LumiInput,
  Textarea: LumiTextarea,
  NumberInput: LumiNumberInput,
  Select: LumiSelect,
  MultiSelect: LumiMultiSelect,
  Checkbox: LumiCheckbox,
  CheckboxGroup: LumiCheckboxGroup,
  RadioGroup: LumiRadioGroup,
  Switch: LumiSwitch,
  DatePicker: LumiDatePicker,
  TimePicker: LumiTimePicker,
  DateTimePicker: LumiDateTimePicker,
  DateRangePicker: LumiDateRangePicker,
  Cascader: LumiCascader,
  Upload: LumiUpload,
  TagsInput: LumiTagsInput,
} satisfies Record<WidgetType, React.ComponentType<any>>

export function LumiFormField(props: FormFieldProps & HostProps): ReactElement {
  const { label, help, error, errorDisplay = 'inline', required, fieldType = 'string', widget, className, children, ...controlProps } = props
  const Control = widgets[widget ?? defaultWidgetForField(fieldType)] as ComponentType<any>
  const id = useId()
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined
  const choice = Control === LumiCheckbox || Control === LumiSwitch
  const field = children ?? <Control {...controlProps} id={id} required={required} invalid={Boolean(error) || props.invalid} ariaLabel={props.ariaLabel ?? (typeof label === 'string' ? label : undefined)} aria-describedby={describedBy} />
  const tooltip = errorDisplay === 'tooltip'
  const control = tooltip ? <LumiFieldErrorTip id={errorId ?? `${id}-error`} message={error} className={choice ? 'w-fit' : undefined}>{field}</LumiFieldErrorTip> : field
  const inlineError = error && !tooltip && <FieldError id={errorId}>{error}</FieldError>
  // Choice controls read as a settings row: the copy claims the free space on the
  // left and pushes the control to the far edge — upstream's FieldContent pattern.
  if (choice) {
    return (
      <Field className={className} orientation="horizontal" data-invalid={Boolean(error) || props.invalid} data-disabled={props.disabled}>
        <FieldContent>
          {label && (
            <FieldLabel htmlFor={children ? undefined : id}>
              {label}
              {required && <span data-slot="required-mark" aria-hidden> *</span>}
            </FieldLabel>
          )}
          {help && <FieldDescription id={helpId}>{help}</FieldDescription>}
          {inlineError}
        </FieldContent>
        {control}
      </Field>
    )
  }
  return (
    <Field className={className} orientation="vertical" data-invalid={Boolean(error) || props.invalid} data-disabled={props.disabled}>
      {label && (
        <FieldLabel htmlFor={children ? undefined : id}>
          {label}
          {required && <span data-slot="required-mark" aria-hidden> *</span>}
        </FieldLabel>
      )}
      {control}
      {help && <FieldDescription id={helpId}>{help}</FieldDescription>}
      {inlineError}
    </Field>
  )
}
