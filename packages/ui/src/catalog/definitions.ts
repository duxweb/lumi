import { ValidationCheckSchema } from '@json-render/core'
import { z } from 'zod'
import { agentDefinitions } from './agent.js'
import { codeDefinitions } from './code.js'
import { contentDefinitions } from './content.js'
import { emptyContentSchema, feedbackDisplayDefinitions } from './feedback-display.js'
import { filterOptionSchema, listFilterSchema } from './filter.js'
import { formControlsPlusDefinitions } from './form-controls-plus.js'
import { TREE_CHECK_STRATEGIES, treeNodeSchema } from './tree.js'

/**
 * A registered command a table offers, per row or over the selection. A
 * `primary` tone marks the one accent action of a selection bar.
 */
const tableActionSchema = z.strictObject({
  value: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  tone: z
    .union([
      z.literal('danger'),
      z.literal('neutral'),
      z.literal('primary'),
      z.literal('success'),
      z.literal('warning'),
      z.literal('info'),
    ])
    .optional(),
  disabled: z.boolean().optional(),
})

/** One choice in a picker list; `avatar` and `image` make it a rich row. */
const choiceOptionSchema = z.strictObject({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  disabled: z.boolean().optional(),
  description: z.string().optional(),
  avatar: z.string().optional(),
  image: z.string().optional(),
})

export const uiComponentDefinitions = {
  ...feedbackDisplayDefinitions,
  ...formControlsPlusDefinitions,
  ...agentDefinitions,
  Fragment: {
    props: z
      .strictObject({
        layout: z.union([z.literal('stack'), z.literal('split')]).optional(),
        asideWidth: z.number().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: [],
    description: 'Groups children without a surface. `stack` stacks them, `split` puts the last child in an aside. For general layout use Stack and Grid.',
  },
  Button: {
    props: z
      .strictObject({
        label: z.string().optional(),
        appearance: z
          .union([
            z.literal('solid'),
            z.literal('brand'),
            z.literal('soft'),
            z.literal('outline'),
            z.literal('ghost'),
            z.literal('link'),
            z.literal('danger'),
          ])
          .optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        shape: z
          .union([
            z.literal('default'),
            z.literal('pill'),
            z.literal('circle'),
            z.literal('square'),
          ])
          .optional(),
        loading: z.boolean().optional(),
        icon: z.string().optional(),
        iconPosition: z
          .union([z.literal('left'), z.literal('right')])
          .optional(),
        block: z.boolean().optional(),
        href: z.string().optional(),
        type: z
          .union([z.literal('button'), z.literal('submit'), z.literal('reset')])
          .optional(),
        disabled: z.boolean().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['press'],
    description: 'Triggers an action. Solid, outline, ghost and brand appearances, with loading and disabled states.',
  },
  Input: {
    props: z
      .strictObject({
        value: z.union([z.string(), z.number()]).optional(),
        defaultValue: z.union([z.string(), z.number()]).optional(),
        type: z.string().optional(),
        clearable: z.boolean().optional(),
        /** Input pattern: `9` a digit, `A` a letter, `*` either; other characters are typed for the user, e.g. `999-9999-9999`. */
        mask: z.string().optional(),
        /** With `mask`, binds only the typed characters instead of the masked text. */
        unmask: z.boolean().optional(),
        /** Fixed text inside the outline before the value, e.g. a URL path or currency; not part of the value. */
        prefix: z.string().optional(),
        /** Fixed text inside the outline after the value, e.g. a unit or domain; not part of the value. */
        suffix: z.string().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Single-line text entry bound to state. Supports prefix, suffix and a clear button.',
  },
  Textarea: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        rows: z.number().optional(),
        autoResize: z.boolean().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Multi-line text entry; `autoResize` grows it with its content.',
  },
  RichText: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        rows: z.number().optional(),
        autoResize: z.boolean().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Markdown text entry with a formatting toolbar. The value stays plain Markdown.',
  },
  NumberInput: {
    props: z
      .strictObject({
        value: z.union([z.null(), z.number()]).optional(),
        defaultValue: z.union([z.null(), z.number()]).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().optional(),
        precision: z.number().optional(),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Numeric entry with `min`, `max` and `step`. The value is a number or null.',
  },
  Select: {
    props: z
      .strictObject({
        value: z
          .union([z.null(), z.string(), z.number(), z.boolean()])
          .optional(),
        defaultValue: z
          .union([z.null(), z.string(), z.number(), z.boolean()])
          .optional(),
        options: z.array(choiceOptionSchema),
        /** Labels for selected values that are not in `options`, e.g. a preselected id beyond the loaded page. */
        selectedOptions: z.array(choiceOptionSchema).optional(),
        clearable: z.boolean().optional(),
        filterable: z.boolean().optional(),
        loading: z.boolean().optional(),
        loadingMore: z.boolean().optional(),
        /** More options exist past the end of the list; scrolling to the end asks for them. */
        hasMore: z.boolean().optional(),
        placeholder: z.string().optional(),
        /** Muted label inside the trigger before the value, e.g. `Status  To ship`. */
        labelPrefix: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change', 'loadMore'],
    // `loadMore` fires when the list is scrolled to its end while `hasMore` is set.
    description: 'Picks one option from a list, with optional search and clear. Options may show an avatar or image and a description line; with `hasMore` set, scrolling the list to its end emits `loadMore`, where a page appends the next options (connected Admin selects load them themselves).',
  },
  MultiSelect: {
    props: z
      .strictObject({
        value: z
          .array(z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
        defaultValue: z
          .array(z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
        options: z.array(choiceOptionSchema),
        /** Labels for selected values that are not in `options`, e.g. preselected ids beyond the loaded page. */
        selectedOptions: z.array(choiceOptionSchema).optional(),
        clearable: z.boolean().optional(),
        filterable: z.boolean().optional(),
        loading: z.boolean().optional(),
        loadingMore: z.boolean().optional(),
        /** More options exist past the end of the list; scrolling to the end asks for them. */
        hasMore: z.boolean().optional(),
        direction: z.union([z.literal('row'), z.literal('column')]).optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change', 'loadMore'],
    // `loadMore` fires when the list is scrolled to its end while `hasMore` is set.
    description: 'Picks several options from a list. The value is an array of option values. Options may show an avatar or image and a description line; with `hasMore` set, scrolling the list to its end emits `loadMore`, where a page appends the next options (connected Admin selects load them themselves).',
  },
  Checkbox: {
    props: z
      .strictObject({
        value: z.boolean().optional(),
        defaultValue: z.boolean().optional(),
        label: z.string().optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'A single on or off choice with a label.',
  },
  CheckboxGroup: {
    props: z
      .strictObject({
        value: z
          .array(z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
        defaultValue: z
          .array(z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
        options: z.array(
          z.strictObject({
            label: z.string(),
            value: z.union([z.string(), z.number(), z.boolean()]),
            disabled: z.boolean().optional(),
            description: z.string().optional(),
          }),
        ),
        direction: z.union([z.literal('row'), z.literal('column')]).optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Picks several options, all visible at once. Suits short lists.',
  },
  RadioGroup: {
    props: z
      .strictObject({
        value: z.union([z.string(), z.number(), z.boolean()]).optional(),
        defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
        options: z.array(
          z.strictObject({
            label: z.string(),
            value: z.union([z.string(), z.number(), z.boolean()]),
            disabled: z.boolean().optional(),
            description: z.string().optional(),
          }),
        ),
        direction: z.union([z.literal('row'), z.literal('column')]).optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Picks one option, all visible at once. Suits short lists.',
  },
  Switch: {
    props: z
      .strictObject({
        value: z.boolean().optional(),
        defaultValue: z.boolean().optional(),
        label: z.string().optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Turns a setting on or off with immediate effect.',
  },
  DatePicker: {
    props: z
      .strictObject({
        /** `null` is an empty field, which is what clearing writes. */
        value: z.string().nullable().optional(),
        defaultValue: z.string().optional(),
        min: z.string().optional(),
        max: z.string().optional(),
        captionLayout: z.union([z.literal('panel'), z.literal('label')]).optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Date as `yyyy-MM-dd`. Opens on the selected month; `min`/`max` bound the days. The month caption switches to month and year grids; `captionLayout: "label"` keeps it plain.',
  },
  Cascader: {
    props: z
      .strictObject({
        options: z.array(treeNodeSchema).optional(),
        value: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
        defaultValue: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
        changeOnSelect: z.boolean().optional(),
        searchable: z.boolean().optional(),
        clearable: z.boolean().optional(),
        loading: z.boolean().optional(),
        separator: z.string().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Hierarchical choice, one column per level (region → city, category → subcategory). The value is the path of option values from the root. `changeOnSelect` lets a parent be chosen; `searchable` finds a path by any label.',
  },
  TimePicker: {
    props: z
      .strictObject({
        /** `null` is an empty field, which is what clearing writes. */
        value: z.string().nullable().optional(),
        defaultValue: z.string().optional(),
        min: z.string().optional(),
        max: z.string().optional(),
        step: z.number().int().min(1).max(30).optional(),
        seconds: z.boolean().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Time of day as `HH:mm` (`HH:mm:ss` with `seconds`). Hour and minute columns; `step` spaces the minutes, `min`/`max` bound the choice.',
  },
  DateTimePicker: {
    props: z
      .strictObject({
        /** `null` is an empty field, which is what clearing writes. */
        value: z.string().nullable().optional(),
        defaultValue: z.string().optional(),
        min: z.string().optional(),
        max: z.string().optional(),
        step: z.number().int().min(1).max(30).optional(),
        seconds: z.boolean().optional(),
        captionLayout: z.union([z.literal('panel'), z.literal('label')]).optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Date and time as a local `yyyy-MM-ddTHH:mm` string, the `datetime-local` format. A calendar beside time columns; `min`/`max` bound the days. The month caption switches to month and year grids; `captionLayout: "label"` keeps it plain.',
  },
  DateRangePicker: {
    props: z
      .strictObject({
        value: z.array(z.string()).max(2).optional(),
        defaultValue: z.array(z.string()).max(2).optional(),
        min: z.string().optional(),
        max: z.string().optional(),
        months: z.number().int().min(1).max(3).optional(),
        presets: z.array(z.strictObject({ label: z.string(), value: z.tuple([z.string(), z.string()]) })).optional(),
        captionLayout: z.union([z.literal('panel'), z.literal('label')]).optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Date range as `[start, end]` (`yyyy-MM-dd`), the same shape as a dateRange filter. Two months side by side; optional `presets` jump to a fixed range. A month caption switches to month and year grids; `captionLayout: "label"` keeps it plain.',
  },
  Form: {
    props: z
      .strictObject({
        layout: z
          .union([
            z.literal('vertical'),
            z.literal('horizontal'),
            z.literal('inline'),
          ])
          .optional(),
        value: z.record(z.string(), z.unknown()).optional(),
        defaultValue: z.record(z.string(), z.unknown()).optional(),
        rules: z.record(z.string(), z.unknown()).optional(),
        disabled: z.boolean().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: ['submit'],
    description: 'Groups fields, runs their `checks` and emits `submit` when they pass. In a JSON page the values live in page state, bound on each field, and business rules go to the `submitForm` action; `value`, `defaultValue` and `rules` here are for React hosts that submit the form themselves.',
  },
  FormField: {
    props: z
      .strictObject({
        name: z.string(),
        label: z.string().optional(),
        fieldType: z
          .union([
            z.literal('string'),
            z.literal('number'),
            z.literal('boolean'),
            z.literal('text'),
            z.literal('date'),
            z.literal('datetime'),
            z.literal('time'),
            z.literal('dateRange'),
            z.literal('enum'),
            z.literal('enumMulti'),
            z.literal('relation'),
            z.literal('relationMulti'),
            z.literal('file'),
            z.literal('richtext'),
            z.literal('json'),
            z.literal('color'),
            z.literal('custom'),
          ])
          .optional(),
        widget: z
          .union([
            z.literal('Input'),
            z.literal('Textarea'),
            z.literal('NumberInput'),
            z.literal('Select'),
            z.literal('MultiSelect'),
            z.literal('Checkbox'),
            z.literal('CheckboxGroup'),
            z.literal('RadioGroup'),
            z.literal('Switch'),
            z.literal('DatePicker'),
            z.literal('TimePicker'),
            z.literal('DateTimePicker'),
            z.literal('DateRangePicker'),
            z.literal('Cascader'),
            z.literal('Upload'),
            z.literal('TagsInput'),
          ])
          .optional(),
        required: z.boolean().optional(),
        error: z.string().optional(),
        /** `inline` (default) writes the error under the control; `tooltip` only marks the control invalid and shows the message above it on hover, focus and right after a failed submit, so the layout never shifts. */
        errorDisplay: z.enum(['inline', 'tooltip']).optional(),
        help: z.string().optional(),
        value: z.unknown().optional(),
        defaultValue: z.unknown().optional(),
        options: z
          .array(
            z.strictObject({
              label: z.string(),
              value: z.union([z.string(), z.number(), z.boolean()]),
              disabled: z.boolean().optional(),
              description: z.string().optional(),
              // Opens the next column when the widget is a Cascader.
              children: z.array(filterOptionSchema).optional(),
            }),
          )
          .optional(),
        multiple: z.boolean().optional(),
        filterable: z.boolean().optional(),
        clearable: z.boolean().optional(),
        type: z.string().optional(),
        /** Input mask for the `Input` widget; see Input. */
        mask: z.string().optional(),
        unmask: z.boolean().optional(),
        loading: z.boolean().optional(),
        rows: z.number().optional(),
        autoResize: z.boolean().optional(),
        min: z.union([z.string(), z.number()]).optional(),
        max: z.union([z.string(), z.number()]).optional(),
        step: z.number().optional(),
        precision: z.number().optional(),
        /** Fixed text before or after the value for the `Input` and `NumberInput` widgets. */
        prefix: z.string().optional(),
        suffix: z.string().optional(),
        direction: z.union([z.literal('row'), z.literal('column')]).optional(),
        accept: z.string().optional(),
        maxSize: z.number().optional(),
        preview: z.boolean().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: ['change'],
    description: 'One labelled field: chooses a control from `fieldType` or `widget`, and shows help and errors.',
  },
  Table: {
    props: z
      .strictObject({
        rows: z.array(z.record(z.string(), z.unknown())),
        columns: z.array(
          z.strictObject({
            field: z.string(),
            label: z.string().optional(),
            width: z.string().optional(),
            sortable: z.boolean().optional(),
            align: z
              .union([
                z.literal('left'),
                z.literal('right'),
                z.literal('center'),
              ])
              .optional(),
            kind: z
              .union([
                z.literal('text'),
                z.literal('date'),
                z.literal('datetime'),
                z.literal('code'),
                z.literal('badge'),
                z.literal('tags'),
                z.literal('entity'),
                z.literal('currency'),
                z.literal('actions'),
              ])
              .optional(),
            valueMap: z.record(z.string(), z.string()).optional(),
            toneMap: z
              .record(
                z.string(),
                z.union([
                  z.literal('danger'),
                  z.literal('neutral'),
                  z.literal('primary'),
                  z.literal('success'),
                  z.literal('warning'),
                  z.literal('info'),
                  z.literal('brand'),
                ]),
              )
              .optional(),
            descriptionField: z.string().optional(),
            imageField: z.string().optional(),
            labelField: z.string().optional(),
            initials: z.boolean().optional(),
            truncate: z.boolean().optional(),
            wrap: z.boolean().optional(),
            currency: z.string().optional(),
            actions: z.array(tableActionSchema).optional(),
          }),
        ),
        bulkActions: z.array(tableActionSchema).optional(),
        visibleColumns: z.array(z.string()).optional(),
        columnOrder: z.array(z.string()).optional(),
        sorters: z
          .array(
            z.strictObject({
              field: z.string(),
              order: z.union([z.literal('asc'), z.literal('desc')]),
            }),
          )
          .optional(),
        rowKey: z.string().optional(),
        highlightField: z.string().optional(),
        loading: z.boolean().optional(),
        /** The empty state: a title, or `{ title, description?, icon? }`; `""` leaves no row, for a host that draws its own. */
        empty: z.union([z.string(), emptyContentSchema]).optional(),
        showHeader: z.boolean().optional(),
        selectable: z.boolean().optional(),
        selectedKeys: z.array(z.union([z.string(), z.number()])).optional(),
        total: z.number().optional(),
        summary: z.string().optional(),
        totals: z
          .array(
            z.strictObject({
              label: z.string(),
              value: z.string(),
              emphasis: z.boolean().optional(),
            }),
          )
          .optional(),
      })
      .extend({
        activeRow: z.record(z.string(), z.unknown()).optional(),
        activeAction: z.string().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['rowActions'],
    events: ['sort', 'rowClick', 'rowAction', 'selectionChange', 'bulkAction'],
    description: 'Rows and columns with sorting, selection and cell kinds such as badge, tags and currency. `rowActions` elements render in each row of the `kind: "actions"` column with their own `on`; props read the row via `$item`, params via the bound `activeRow`. Otherwise the column\'s `actions` menu emits `rowAction`. `highlightField` tints rows whose field is truthy. While rows are selected, `bulkActions` show a selection bar; `bulkAction` binds the pressed value to `activeAction`.',
  },
  DescriptionList: {
    props: z
      .strictObject({
        items: z.array(
          z.strictObject({
            label: z.string(),
            value: z.union([z.null(), z.string(), z.number(), z.boolean()]),
            span: z.literal('full').optional(),
          }),
        ),
        layout: z.union([z.literal('grid'), z.literal('rows')]).optional(),
        /** One rounded frame around the list with hairlines between rows, for a summary inside a card or a confirmation. */
        bordered: z.boolean().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'Label/value pairs. `grid` fills responsive columns with the label above the value; `rows` puts the label beside the value for narrow panels. A `span: "full"` item takes the whole row and wraps long text such as an address or note. `bordered` draws one rounded frame around the list with hairlines between the rows, for an order summary or a confirmation.',
  },
  Pagination: {
    props: z
      .strictObject({
        page: z.number(),
        pageSize: z.number(),
        total: z.number(),
        disabled: z.boolean().optional(),
        ariaLabel: z.string().optional(),
        pageSizeOptions: z.array(z.number()).optional(),
        showTotal: z.boolean().optional(),
        /** `pages` (default) numbers the pages, folding long runs into an ellipsis; `simple` shows `3 / 12` between the arrows. */
        variant: z.enum(['pages', 'simple']).optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['pageChange', 'pageSizeChange'],
    description: 'Moves through pages of a list, with an optional total and page-size choice. `pages` (default) numbers the pages, as in `1 2 3 … 10`, keeping the first, the last and the neighbours of the current page; `simple` shows the position as `3 / 12` between the arrows, for narrow places and lists walked one page at a time. The page size uses the Select list.',
  },
  Dialog: {
    props: z
      .strictObject({
        open: z.boolean().optional(),
        defaultOpen: z.boolean().optional(),
        title: z.string(),
        description: z.string().optional(),
        size: z
          .union([
            z.literal('sm'),
            z.literal('md'),
            z.literal('lg'),
            z.literal('xl'),
          ])
          .optional(),
        tone: z
          .union([
            z.literal('danger'),
            z.literal('neutral'),
            z.literal('primary'),
            z.literal('success'),
            z.literal('warning'),
            z.literal('info'),
          ])
          .optional(),
        icon: z.union([z.string(), z.literal(false)]).optional(),
        confirmText: z.string().optional(),
        cancelText: z.string().optional(),
        loading: z.boolean().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default', 'footerStart', 'footerEnd'],
    events: ['openChange', 'confirm', 'cancel'],
    description: 'A modal panel for a focused task or a confirmation; its width follows the content within the size range. Lead-in text belongs in description, which sits under the title in the header, not as the first child. Without children it is a compact confirmation sized to its title and description, led by a tone icon unless icon is false.',
  },
  Drawer: {
    props: z
      .strictObject({
        open: z.boolean().optional(),
        defaultOpen: z.boolean().optional(),
        title: z.string(),
        description: z.string().optional(),
        side: z
          .union([
            z.literal('left'),
            z.literal('right'),
            z.literal('top'),
            z.literal('bottom'),
          ])
          .optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default', 'footerStart', 'footerEnd'],
    events: ['openChange'],
    description: 'A side panel that keeps the page in view, for details and edit forms.',
  },
  Card: {
    props: z
      .strictObject({
        title: z.string().optional(),
        description: z.string().optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        icon: z.string().nullish(),
        href: z.string().nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default', 'headerEnd'],
    events: [],
    description: 'Surface with an optional title, description and header icon. `href` turns the whole card into a link, e.g. a shortcut tile.',
  },
  Tabs: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        items: z.array(
          z.strictObject({
            label: z.string(),
            value: z.string(),
            disabled: z.boolean().optional(),
            content: z.string().optional(),
          }),
        ),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: ['change'],
    description: 'Switches between sibling views in one place.',
  },
  Upload: {
    props: z
      .strictObject({
        value: z.array(z.string()).optional(),
        defaultValue: z.array(z.string()).optional(),
        /** `dropzone` (default) is a dashed drop target over a file list; `button` is compact; `image` is a single avatar/cover tile. */
        variant: z.enum(['dropzone', 'button', 'image']).optional(),
        /** Tile shape of the `image` variant. */
        shape: z.enum(['square', 'circle']).optional(),
        accept: z.string().optional(),
        multiple: z.boolean().optional(),
        /** Most files the field holds when `multiple`. */
        maxFiles: z.number().int().min(1).optional(),
        /** Largest accepted file in bytes. */
        maxSize: z.number().optional(),
        /** Replaces the generated "types up to size" line. */
        hint: z.string().optional(),
        preview: z.boolean().optional(),
        loading: z.boolean().optional(),
        progress: z.number().min(0).max(100).optional(),
        error: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Sends files with progress, cancel and retry. The upload itself comes from a host service.',
  },
  Badge: {
    props: z
      .strictObject({
        label: z.string().optional(),
        tone: z
          .union([
            z.literal('danger'),
            z.literal('neutral'),
            z.literal('primary'),
            z.literal('success'),
            z.literal('warning'),
            z.literal('info'),
            z.literal('brand'),
          ])
          .optional(),
        appearance: z
          .union([z.literal('solid'), z.literal('soft'), z.literal('outline')])
          .optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'A short status or count label in a semantic tone. The `brand` tone marks brand-coloured emphasis: soft is a brand tint with brand text, solid is the brand ground.',
  },
  Tooltip: {
    props: z
      .strictObject({
        content: z.string(),
        side: z.enum(['top', 'right', 'bottom', 'left']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: [],
    description: 'A short hint shown on hover and keyboard focus of its single child, such as an icon button. Put the full name in the child; the tooltip only adds a hint.',
  },
  Menu: {
    props: z
      .strictObject({
        label: z.string(),
        icon: z.string().nullish(),
        appearance: z.enum(['solid', 'brand', 'soft', 'outline', 'ghost']).nullish(),
        size: z.enum(['sm', 'md', 'lg']).nullish(),
        shape: z.enum(['default', 'pill', 'circle', 'square']).nullish(),
        align: z.enum(['start', 'end']).nullish(),
        items: z.array(z.strictObject({
          key: z.string(),
          label: z.string(),
          icon: z.string().nullish(),
          shortcut: z.string().nullish(),
          tone: z.enum(['danger']).nullish(),
          disabled: z.boolean().nullish(),
          group: z.string().nullish(),
          separatorBefore: z.boolean().nullish(),
        })),
        value: z.string().nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['select'],
    description: 'A button that opens a list of commands. Picking one writes its key to the bound `value` ({ "$bindState": "/path" }) and emits `select`; bind `on.select` to the action that handles it. A circle or square shape with an icon shows the icon only and uses the label as its name.',
  },
  Accordion: {
    props: z
      .strictObject({
        items: z.array(z.strictObject({
          key: z.string(),
          title: z.string(),
          content: z.string(),
          disabled: z.boolean().nullish(),
        })),
        multiple: z.boolean().nullish(),
        defaultOpen: z.array(z.string()).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'Sections that fold open: one at a time by default, or several with `multiple`. `defaultOpen` lists the keys open on first render.',
  },
  Popover: {
    props: z
      .strictObject({
        label: z.string().nullish(),
        icon: z.string().nullish(),
        appearance: z.enum(['solid', 'brand', 'soft', 'outline', 'ghost']).nullish(),
        size: z.enum(['sm', 'md', 'lg']).nullish(),
        shape: z.enum(['default', 'pill', 'circle', 'square']).nullish(),
        title: z.string().nullish(),
        description: z.string().nullish(),
        side: z.enum(['top', 'right', 'bottom', 'left']).nullish(),
        align: z.enum(['start', 'center', 'end']).nullish(),
        width: z.enum(['sm', 'md', 'lg']).nullish(),
        open: z.boolean().nullish(),
        defaultOpen: z.boolean().nullish(),
        confirmText: z.string().nullish(),
        cancelText: z.string().nullish(),
        tone: z.enum(['default', 'danger']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default', 'trigger', 'footer'],
    events: ['openChange', 'confirm', 'cancel'],
    description: 'A floating panel anchored to a trigger: a title, a description, any body (`children`) and optional footer actions. The trigger is the `trigger` slot (any element, e.g. a Button or an Avatar) or, without it, a button built from `label`/`icon`/`appearance`/`size`/`shape`. Bind `open` ({ "$bindState": "/path" }) to open or close it from actions; `confirmText`/`cancelText` add footer buttons that emit `confirm`/`cancel` and close the panel. `width`: sm 16rem, md 18rem (default), lg 24rem.',
  },
  Popconfirm: {
    props: z
      .strictObject({
        title: z.string(),
        description: z.string().nullish(),
        confirmText: z.string().nullish(),
        cancelText: z.string().nullish(),
        tone: z.enum(['danger', 'warning', 'neutral']).nullish(),
        side: z.enum(['top', 'right', 'bottom', 'left']).nullish(),
        align: z.enum(['start', 'center', 'end']).nullish(),
        open: z.boolean().nullish(),
        defaultOpen: z.boolean().nullish(),
        disabled: z.boolean().nullish(),
        label: z.string().nullish(),
        icon: z.string().nullish(),
        appearance: z.enum(['solid', 'brand', 'soft', 'outline', 'ghost', 'danger']).nullish(),
        size: z.enum(['sm', 'md', 'lg']).nullish(),
        shape: z.enum(['default', 'pill', 'circle', 'square']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: ['confirm', 'cancel', 'openChange'],
    description: 'Asks "are you sure?" in a small bubble beside a destructive inline action, without a modal. Wrap the action (`children`, e.g. a Button) or build a button from `label`/`icon`/`appearance`. Confirming emits `confirm` (chain the real action there), cancelling, Escape or clicking away emit `cancel`. `tone` (default `danger`) colours the icon and the confirm button. Focus moves to Cancel and returns to the trigger.',
  },
  Image: {
    props: z
      .strictObject({
        src: z.string(),
        alt: z.string().nullish(),
        aspectRatio: z.enum(['auto', '1/1', '4/3', '3/2', '16/9', '21/9', '3/4']).nullish(),
        fit: z.enum(['cover', 'contain']).nullish(),
        radius: z.enum(['none', 'sm', 'md', 'lg', 'full']).nullish(),
        width: z.number().positive().nullish(),
        caption: z.string().nullish(),
        preview: z.boolean().nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'An image in a fixed `aspectRatio` frame (default 4/3; `auto` keeps its own) with a loading shimmer and an image-off fallback when it fails. `radius` follows the theme (md by default). `preview` makes it a button that opens the full-screen Lightbox. `width` caps it in px; `caption` prints below and labels the preview.',
  },
  Iframe: {
    props: z
      .strictObject({
        src: z.string(),
        title: z.string(),
        height: z.union([z.number().positive(), z.literal('fill')]).nullish(),
        aspectRatio: z.enum(['1/1', '4/3', '3/2', '16/9', '21/9', '3/4']).nullish(),
        sandbox: z.boolean().nullish(),
        allowFullscreen: z.boolean().nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'Another web page in a sandboxed frame. `src` must be https or a path on this site, and one of `LumiEmbedProvider` origins when set (Admin `frameOrigins`); otherwise a notice shows. Lumi passes the frame no sign-in token; a page on this site still shares the storage and cookies of this site, as any same-site page does, so frame only same-site pages you serve yourself. `height` in px (480) or `fill`, or `aspectRatio`.',
  },
  Lightbox: {
    props: z
      .strictObject({
        items: z.array(z.strictObject({
          url: z.string(),
          alt: z.string().nullish(),
          caption: z.string().nullish(),
        })),
        open: z.boolean().nullish(),
        index: z.number().int().min(0).nullish(),
        loop: z.boolean().nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['openChange', 'change'],
    description: 'A full-screen image viewer with zoom (buttons, wheel, double-click; drag to pan), previous/next, a counter and a caption. Keyboard: Escape closes, ←/→ step, +/− zoom, 0 resets. Bind `open` and `index` ({ "$bindState": "/path" }) and open it from a Button action; `change` fires when the image changes. Image and ImageGrid open it themselves.',
  },
  Carousel: {
    props: z
      .strictObject({
        items: z.array(z.strictObject({
          url: z.string(),
          alt: z.string().nullish(),
          title: z.string().nullish(),
          description: z.string().nullish(),
        })).nullish(),
        aspectRatio: z.enum(['1/1', '4/3', '3/2', '16/9', '21/9']).nullish(),
        perView: z.number().int().min(1).max(4).nullish(),
        autoplay: z.boolean().nullish(),
        interval: z.number().int().min(2000).nullish(),
        loop: z.boolean().nullish(),
        arrows: z.boolean().nullish(),
        dots: z.boolean().nullish(),
        value: z.number().int().min(0).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: ['change'],
    description: 'Slides on a scroll-snap track with previous/next buttons and dots. Slides are `items` (images with an optional title and description over them) or the children, one slide each. `perView` shows several at once. `autoplay` advances every `interval` ms (default 5000), pauses on hover and focus, offers a pause button and stays off under reduced motion. Bind `value` to the current slide index; `change` fires when it moves.',
  },
  Breadcrumb: {
    props: z
      .strictObject({
        items: z.array(z.strictObject({
          key: z.string(),
          label: z.string(),
          href: z.string().nullish(),
          icon: z.string().nullish(),
        })),
        maxItems: z.number().int().min(3).nullish(),
        separator: z.enum(['chevron', 'slash']).nullish(),
        value: z.string().nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['select'],
    description: 'The path to the current page; the last item is the current page. An item with `href` is a link; one without writes its key to the bound `value` ({ "$bindState": "/path" }) and emits `select`, so an action decides where to go. Past `maxItems` (default 4) the middle items fold into an overflow menu.',
  },
  Alert: {
    props: z
      .strictObject({
        tone: z
          .union([
            z.literal('danger'),
            z.literal('neutral'),
            z.literal('primary'),
            z.literal('success'),
            z.literal('warning'),
            z.literal('info'),
          ])
          .optional(),
        title: z.string().optional(),
        message: z.string().optional(),
        closable: z.boolean().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['close'],
    description: 'A message inside the page in a semantic tone, optionally closable.',
  },
  Icon: {
    props: z
      .strictObject({
        name: z.string(),
        label: z.string().nullish(),
        size: z.enum(['sm', 'md', 'lg']).nullish(),
        tone: z.enum(['default', 'muted', 'brand', 'success', 'warning', 'danger', 'info']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'An icon by name: a Lumi name such as `search` or any HugeIcons free icon such as `delivery-truck-01` (or `DeliveryTruck01Icon`); names outside the bundled set load on first use. Give `label` when the icon carries meaning on its own.',
  },
  Progress: {
    props: z
      .strictObject({
        value: z.number().nullish(),
        max: z.number().nullish(),
        label: z.string().nullish(),
        tone: z.enum(['default', 'brand', 'success', 'warning', 'danger']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'Progress bar, compatible with the json-render shadcn Progress. `value` runs from 0 to `max` (default 100); `label` is shown above the bar and names it.',
  },
  Stack: {
    props: z
      .strictObject({
        direction: z.enum(['horizontal', 'vertical']).nullish(),
        gap: z.enum(['none', 'sm', 'md', 'lg', 'xl']).nullish(),
        align: z.enum(['start', 'center', 'end', 'stretch']).nullish(),
        justify: z.enum(['start', 'center', 'end', 'between', 'around']).nullish(),
        wrap: z.boolean().nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: [],
    description: 'Flex container for layouts, compatible with the json-render shadcn Stack. Vertical by default; `wrap` lets a horizontal row of buttons, badges or links wrap.',
  },
  Grid: {
    props: z
      .strictObject({
        columns: z.number().int().min(1).max(6).nullish(),
        gap: z.enum(['sm', 'md', 'lg', 'xl']).nullish(),
        minColumnWidth: z.number().nullish(),
        align: z.enum(['start', 'stretch']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: [],
    description: 'Grid layout (1-6 columns), compatible with the json-render shadcn Grid; drops columns as its own width shrinks (each column stays at least 12rem), so it also works inside drawers, cards and embedded previews. `minColumnWidth` (px) instead fits as many columns as the width allows. `align: "stretch"` gives the items of a row one height, as for a row of cards.',
  },
  Separator: {
    props: z
      .strictObject({
        orientation: z.enum(['horizontal', 'vertical']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'Visual separator line.',
  },
  Heading: {
    props: z
      .strictObject({
        text: z.string(),
        level: z.enum(['h1', 'h2', 'h3', 'h4']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'Heading text (h1-h4). Inside an Admin page the page header already provides the h1; sections usually use h2 or h3.',
  },
  Text: {
    props: z
      .strictObject({
        text: z.string(),
        variant: z.enum(['body', 'caption', 'muted', 'lead', 'code']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'role': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'Paragraph text at a readable measure, compatible with the json-render shadcn Text. `muted` for secondary copy, `caption` for small print, `lead` for an intro, `code` for inline code. Line breaks in `text` are kept.',
  },
  Avatar: {
    props: z
      .strictObject({
        name: z.string(),
        src: z.string().nullish(),
        description: z.string().nullish(),
        showName: z.boolean().nullish(),
        size: z.enum(['sm', 'md', 'lg', 'xl']).nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'A person or account: image or initials on a tint picked from the name, with no outline. `sm`/`md`/`lg` match the control heights; `xl` leads a profile header. `showName` adds the name and an optional description beside it.',
  },
  AvatarGroup: {
    props: z
      .strictObject({
        items: z.array(z.strictObject({ name: z.string(), src: z.string().nullish() })),
        max: z.number().int().positive().nullish(),
        size: z.enum(['sm', 'md', 'lg']).nullish(),
        label: z.string().nullish(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'A stack of overlapping avatars for the people on a record. Beyond `max`, the rest collapse into a "+N" avatar.',
  },
  ...codeDefinitions,
  ...contentDefinitions,
  Frame: {
    props: z
      .strictObject({
        title: z.string().optional(),
        description: z.string().optional(),
        summary: z.string().optional(),
        content: z.string().optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default', 'headerEnd', 'footerStart', 'footerEnd'],
    events: [],
    description: 'A generic box for padding, surface and border when no other layout fits.',
  },
  Filters: {
    props: z.strictObject({
      'schema': listFilterSchema,
      'applyMode': z.enum(['immediate', 'explicit']),
      'value': z.record(z.string(), z.unknown()).optional(),
      'defaultValue': z.record(z.string(), z.unknown()).optional(),
      'disabled': z.boolean().optional(),
      'loading': z.boolean().optional(),
      'className': z.string().optional(),
      'data-testid': z.string().optional(),
    }),
    slots: ['toolbarEnd'],
    events: ['change'],
    description: 'Controlled list filters with optional advanced conditions.',
  },
  Stepper: {
    props: z
      .strictObject({
        items: z.array(
          z.strictObject({
            key: z.string(),
            label: z.string(),
            description: z.string().optional(),
            status: z
              .union([
                z.literal('complete'),
                z.literal('current'),
                z.literal('upcoming'),
                z.literal('loading'),
                z.literal('error'),
              ])
              .optional(),
          }),
        ),
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        orientation: z
          .union([z.literal('vertical'), z.literal('horizontal')])
          .optional(),
        linear: z.boolean().optional(),
        disabled: z.boolean().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: ['default'],
    events: ['change'],
    description: 'Shows progress through ordered steps, optionally clickable.',
  },
  TagsInput: {
    props: z
      .strictObject({
        value: z.array(z.string()).optional(),
        defaultValue: z.array(z.string()).optional(),
        placeholder: z.string().optional(),
        /** Most tags the field accepts; the input stops taking text once it is reached. */
        max: z.number().int().min(1).optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        error: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Text tags as removable chips. Enter adds the typed tag, Backspace in the empty input removes the last. Bind `value` as a string array, or use it through FormField with `widget: "TagsInput"`.',
  },
  AutoComplete: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        /** Suggestions; choosing one writes its label. The typed text stays a valid value. */
        options: z.array(choiceOptionSchema).optional(),
        loading: z.boolean().optional(),
        clearable: z.boolean().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change', 'select'],
    description: 'Free text entry that suggests matching options as you type, with the matched part highlighted. Arrow keys move through suggestions, Enter takes one. The value is the text.',
  },
  Mention: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        /** People or things to mention; choosing one inserts `trigger` + label. */
        options: z.array(choiceOptionSchema).optional(),
        /** Character that opens the suggestions. Defaults to `@`. */
        trigger: z.string().min(1).max(1).optional(),
        loading: z.boolean().optional(),
        rows: z.number().optional(),
        autoResize: z.boolean().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change', 'select'],
    description: 'Multi-line text where typing the trigger (`@` by default) opens a suggestion list at the caret; choosing one inserts the mention. The value stays plain text.',
  },
  Transfer: {
    props: z
      .strictObject({
        value: z
          .array(z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
        defaultValue: z
          .array(z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
        /** Every item that can be chosen; chosen ones move to the target list. */
        options: z.array(choiceOptionSchema).optional(),
        /** Labels for chosen values that are not in `options`. */
        selectedOptions: z.array(choiceOptionSchema).optional(),
        sourceTitle: z.string().optional(),
        targetTitle: z.string().optional(),
        /** Show a search box in each list. Defaults to true. */
        filterable: z.boolean().optional(),
        loading: z.boolean().optional(),
        loadingMore: z.boolean().optional(),
        /** More source items exist past the end of the list; scrolling to the end asks for them. */
        hasMore: z.boolean().optional(),
        /** Size of the whole source, when only part of it is loaded. */
        total: z.number().int().nonnegative().optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Two lists, available and chosen, each with search, check-all and counts; the arrow buttons move checked items across. The value is the array of chosen option values.',
  },
  ImageGrid: {
    props: z
      .strictObject({
        value: z
          .array(
            z.strictObject({
              url: z.string(),
              /** A smaller image for the tile; the viewer still opens `url`. */
              thumbnail: z.string().optional(),
              alt: z.string().optional(),
            }),
          )
          .optional(),
        defaultValue: z
          .array(
            z.strictObject({
              url: z.string(),
              thumbnail: z.string().optional(),
              alt: z.string().optional(),
            }),
          )
          .optional(),
        /** File types the picker offers and a drop accepts; defaults to `image/*`. */
        accept: z.string().optional(),
        /** The picker and a drop take several files at once; defaults to true. */
        multiple: z.boolean().optional(),
        /** Most images the grid holds; the upload tile disappears once it is reached. */
        max: z.number().int().min(1).optional(),
        /** Largest accepted file in bytes. */
        maxSize: z.number().optional(),
        /** Replaces the generated "types up to size" line. */
        hint: z.string().optional(),
        /** Caption on the first tile. */
        coverLabel: z.string().optional(),
        /** Caption on the upload tile. */
        addLabel: z.string().optional(),
        loading: z.boolean().optional(),
        progress: z.number().min(0).max(100).optional(),
        name: z.string().optional(),
        error: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'Image tiles over a bound `{ url, thumbnail?, alt? }[]` value; the first tile is the cover. The upload tile and a file drop take images, checked against `accept`, `maxSize` and `max`; each file shows its progress with cancel, and a failure stays as a tile with retry. Drag a tile, or press Space and the arrow keys, to reorder; Set as cover moves one to the front. The upload itself comes from a host service; without one the chosen files stay local previews.',
  },
  Repeater: {
    props: z
      .strictObject({
        /** The rows, normally `{ "$bindState": "/form/items" }` — the same path as the element's `repeat.statePath`. */
        value: z.array(z.record(z.string(), z.unknown())).optional(),
        layout: z.enum(['table', 'card']).optional(),
        /** One entry per field. Columns without `compute` take the row template's children in order; `compute` columns are read-only figures. */
        columns: z.array(z.strictObject({
          key: z.string(),
          label: z.string(),
          width: z.union([z.number(), z.string()]).optional(),
          align: z.enum(['start', 'center', 'end']).optional(),
          required: z.boolean().optional(),
          /** Card layout: 2 spans the full row. */
          span: z.union([z.literal(1), z.literal(2)]).optional(),
          compute: z.strictObject({ op: z.enum(['product', 'sum']), fields: z.array(z.string()).min(1) }).optional(),
          precision: z.number().int().min(0).max(10).optional(),
          prefix: z.string().optional(),
          suffix: z.string().optional(),
          /** Overrides the Repeater's `errorDisplay` for this column's cells. */
          errorDisplay: z.enum(['inline', 'tooltip']).optional(),
        })),
        /** Footer figures, by column key. */
        summary: z.array(z.strictObject({ key: z.string(), op: z.enum(['sum', 'avg', 'min', 'max', 'count']) })).optional(),
        summaryLabel: z.string().optional(),
        min: z.number().int().min(0).optional(),
        max: z.number().int().min(1).optional(),
        /** Values of a newly added row. */
        newRow: z.record(z.string(), z.unknown()).optional(),
        /** Field that identifies a row; added and duplicated rows get a fresh one. Use it as `repeat.key` too. */
        rowKey: z.string().optional(),
        sortable: z.boolean().optional(),
        addable: z.boolean().optional(),
        removable: z.boolean().optional(),
        duplicable: z.boolean().optional(),
        addLabel: z.string().optional(),
        /** Row heading in the card layout; `{index}` is the 1-based position. */
        rowLabel: z.string().optional(),
        emptyText: z.string().optional(),
        /** Field errors such as submitForm's `fieldErrors`; bind with `$bindState` to keep them on their rows as rows move. */
        errors: z.record(z.string(), z.string()).optional(),
        /** Error path of the array, e.g. `items`: cells read `items.2.qty`, rows `items.2`, the list `items`. */
        name: z.string().optional(),
        /** How cell errors show: `tooltip` (table default) keeps rows one height and shows the message above the invalid cell; `inline` (card default) writes it under the control. */
        errorDisplay: z.enum(['inline', 'tooltip']).optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
      }),
    slots: ['default'],
    events: ['change'],
    description: 'Repeatable rows over a bound array (order lines, contacts) as an editable table or cards, with add, duplicate, remove, reordering by the drag handle (or its arrow keys), min/max, computed columns, footer totals and per-cell errors. Put native `repeat: { statePath, key }` on the Repeater and one `RepeaterRow` child whose children bind cells with `$bindItem`.',
  },
  RepeaterRow: {
    props: z.strictObject({
      'className': z.string().optional(),
      'data-testid': z.string().optional(),
    }),
    slots: ['default'],
    events: [],
    description: 'The row template inside a Repeater\'s `repeat`. Its children are the editable cells, one per non-computed column, in column order.',
  },
  Timeline: {
    props: z
      .strictObject({
        items: z.array(
          z.strictObject({
            key: z.string(),
            title: z.string(),
            description: z.string().optional(),
            timestamp: z.string().optional(),
            tone: z
              .union([
                z.literal('danger'),
                z.literal('neutral'),
                z.literal('primary'),
                z.literal('success'),
                z.literal('warning'),
                z.literal('info'),
                z.literal('brand'),
              ])
              .optional(),
            status: z
              .union([
                z.literal('complete'),
                z.literal('current'),
                z.literal('upcoming'),
                z.literal('loading'),
                z.literal('error'),
              ])
              .optional(),
          }),
        ),
        loading: z.boolean().optional(),
        empty: z.string().optional(),
        /** `dot` draws each event as a small dot in its tone, for activity feeds; `status` keeps the state glyph. */
        marker: z.union([z.literal('status'), z.literal('dot')]).optional(),
        /** `end` puts the time at the end of the title's line; `below` stacks it under the title, for narrow columns. */
        datePlacement: z.enum(['end', 'below']).optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'Events in order on one continuous rule, each with a time, a status and optional detail under the title. The time sits at the end of the title\'s line (`datePlacement: "below"` stacks it under the title). Status markers: complete is a success dot, current a brand ring, upcoming a hollow ring. `marker: "dot"` draws an activity feed: a dot per item in its tone.',
  },
  ActivityFeed: {
    props: z
      .strictObject({
        items: z.array(
          z.strictObject({
            key: z.string(),
            /** Who did it: the avatar's initials and the sentence's first strong word. */
            actor: z.string(),
            /** Avatar image; without it the initials show. */
            avatar: z.string().optional(),
            /** What they did, e.g. `approved`. Read as `actor action target`; a language with another word order places `{actor}` and `{target}` in the phrase. */
            action: z.string(),
            /** What it was done to, in strong text. */
            target: z.string().optional(),
            /** Second line, e.g. the project or record it belongs to. */
            context: z.string().optional(),
            /** A small badge on the second line, e.g. the outcome. */
            status: z.strictObject({
              label: z.string(),
              tone: z.enum(['neutral', 'primary', 'success', 'warning', 'danger', 'info', 'brand']).optional(),
            }).optional(),
            /** When, as shown, e.g. `10 min ago` or `07:30`. */
            timestamp: z.string().optional(),
            /** Machine-readable time for the `<time>` element, e.g. an ISO date. */
            dateTime: z.string().optional(),
          }),
        ),
        loading: z.boolean().optional(),
        empty: z.string().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: [],
    description: 'Who did what, newest first: an avatar, one sentence with the actor and target in strong text (`actor action target`), a second line with context and an optional status badge, and the time at the end of the first line. Use Timeline for a sequence of states.',
  },
  Tree: {
    props: z
      .strictObject({
        items: z.array(treeNodeSchema).optional(),
        /** The selected value (`selectionMode: "single"`), or the selected or checked values as an array. */
        value: z.union([z.null(), z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]).optional(),
        defaultValue: z.union([z.null(), z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]).optional(),
        selectionMode: z.union([z.literal('none'), z.literal('single'), z.literal('multiple')]).optional(),
        checkable: z.boolean().optional(),
        checkStrategy: z.enum(TREE_CHECK_STRATEGIES).optional(),
        expandedValue: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
        defaultExpandedValue: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
        defaultExpandAll: z.boolean().optional(),
        searchable: z.boolean().optional(),
        searchPlaceholder: z.string().optional(),
        showLine: z.boolean().optional(),
        loading: z.boolean().optional(),
        empty: z.string().optional(),
        size: z.union([z.literal('sm'), z.literal('md')]).optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change', 'expandedChange'],
    description: 'Hierarchical list that expands and collapses. `selectionMode` picks one or several nodes; `checkable` adds tri-state checkboxes and binds the checked values (`checkStrategy`: every node, leaves only or topmost parents). `searchable` filters by label, highlights matches and opens their ancestors. Nodes without `children` load on demand when the host connects a source. Bind `expandedValue` to keep the open nodes in state.',
  },
  TreeSelect: {
    props: z
      .strictObject({
        items: z.array(treeNodeSchema).optional(),
        value: z.union([z.null(), z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]).optional(),
        defaultValue: z.union([z.null(), z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]).optional(),
        multiple: z.boolean().optional(),
        checkable: z.boolean().optional(),
        checkStrategy: z.enum(TREE_CHECK_STRATEGIES).optional(),
        searchable: z.boolean().optional(),
        clearable: z.boolean().optional(),
        loading: z.boolean().optional(),
        showPath: z.boolean().optional(),
        separator: z.string().optional(),
        defaultExpandAll: z.boolean().optional(),
        placeholder: z.string().optional(),
        size: z
          .union([z.literal('sm'), z.literal('md'), z.literal('lg')])
          .optional(),
        appearance: z
          .union([z.literal('outline'), z.literal('filled')])
          .optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'A select whose panel is a Tree. Single by default; `multiple` or `checkable` binds an array and shows the first picks as tags. `showPath` writes the full path in the trigger; `searchable` filters the tree inside the panel.',
  },
  CascaderPanel: {
    props: z
      .strictObject({
        options: z.array(treeNodeSchema).optional(),
        /** A path of values from the root, or an array of paths with `multiple`. */
        value: z.union([z.array(z.union([z.string(), z.number(), z.boolean()])), z.array(z.array(z.union([z.string(), z.number(), z.boolean()])))]).optional(),
        defaultValue: z.union([z.array(z.union([z.string(), z.number(), z.boolean()])), z.array(z.array(z.union([z.string(), z.number(), z.boolean()])))]).optional(),
        multiple: z.boolean().optional(),
        changeOnSelect: z.boolean().optional(),
        loading: z.boolean().optional(),
        name: z.string().optional(),
        disabled: z.boolean().optional(),
        readonly: z.boolean().optional(),
        invalid: z.boolean().optional(),
        ariaLabel: z.string().optional(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend({
        'className': z.string().optional(),
        'data-testid': z.string().optional(),
        'aria-label': z.string().optional(),
      }),
    slots: [],
    events: ['change'],
    description: 'The Cascader columns shown inline, without a trigger. The value is the path of option values; `multiple` checks leaves across branches and binds an array of paths.',
  },
}
