import { ValidationCheckSchema } from '@json-render/core'
import { z } from 'zod'

const host = {
  'className': z.string().optional(),
  'data-testid': z.string().optional(),
  'aria-label': z.string().optional(),
}

const size = z.enum(['sm', 'md', 'lg'])
const tone = z.enum(['neutral', 'primary', 'success', 'warning', 'danger', 'info', 'brand'])
const optionValue = z.union([z.string(), z.number(), z.boolean()])
const dateList = z.array(z.string())

/** What an empty region says: why it is empty, what to do next, and its glyph (a HugeIcons name). */
export const emptyContentSchema = z.strictObject({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
})

/** Display and status primitives: loading placeholders, empty states, key chips, tags, inline calendar and list. */
export const feedbackDisplayDefinitions = {
  Skeleton: {
    props: z
      .strictObject({
        variant: z.enum(['text', 'circle', 'rect', 'list-row']).nullish(),
        /** Text lines, or rows of the `list-row` preset. */
        lines: z.number().int().min(1).max(12).nullish(),
        size: size.nullish(),
        /** CSS length for a `rect` or `circle`, e.g. `"100%"` or `"12rem"`. */
        width: z.string().nullish(),
        height: z.string().nullish(),
        animated: z.boolean().nullish(),
        label: z.string().nullish(),
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'A placeholder in the shape of content that is still loading. `text` draws `lines` of natural widths, `circle` an avatar, `rect` a card or image, and `list-row` an avatar with two text lines per row. Shimmers unless the reader prefers reduced motion; `label` names the loading region.',
  },
  Spinner: {
    props: z
      .strictObject({
        size: size.nullish(),
        tone: z.enum(['default', 'muted', 'brand', 'success', 'warning', 'danger', 'info']).nullish(),
        label: z.string().nullish(),
        /** Shows `label` beside the spinner; otherwise it is only spoken. */
        showLabel: z.boolean().nullish(),
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'An indeterminate activity indicator for a pending action or a small area. Sizes match the icon scale; `label` is spoken, and shown beside it with `showLabel`.',
  },
  Loading: {
    props: z
      .strictObject({
        label: z.string().nullish(),
        description: z.string().nullish(),
        size: size.nullish(),
        /** Minimum block height in px, so the area does not collapse while it loads. */
        minHeight: z.number().nullish(),
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'A section that is loading: a spinner and text centred in the area the content will fill. Use Skeleton when the content shape is known.',
  },
  Empty: {
    props: z
      .strictObject({
        /** Why the area is empty, e.g. `No orders yet`. */
        title: z.string().nullish(),
        /** The next step, e.g. `Try clearing the filters`. */
        description: z.string().nullish(),
        /** HugeIcons name of the glyph; `inbox` when omitted. */
        icon: z.string().nullish(),
        /** Tints the glyph: `danger` for a failure, `warning` for a blocked or offline state, `success` for a finished one. */
        tone: z.enum(['neutral', 'info', 'success', 'warning', 'danger']).nullish(),
        /** `sm` inside a table, card or panel; `md` for a whole page or region; `xs` one quiet line for dropdowns and narrow columns. */
        size: z.enum(['xs', 'sm', 'md']).nullish(),
      })
      .extend(host),
    slots: ['default'],
    events: [],
    description: 'An empty state: a glyph on a soft tint, a title saying why the area is empty and a description of what to do next, centred in the space the content would fill. Children (usually one Button) sit below as the way forward.',
  },
  Kbd: {
    props: z
      .strictObject({
        /** One key per chip, e.g. `["⌘", "K"]`. */
        keys: z.array(z.string()).min(1),
        /** Drawn between chips, e.g. `"+"` or `"then"`. Omitted, the chips sit side by side. */
        separator: z.string().nullish(),
        size: z.enum(['sm', 'md']).nullish(),
      })
      .extend(host),
    slots: [],
    events: [],
    description: 'A keyboard shortcut as key chips: one key or a combination such as `["⌘", "K"]`. Modifier symbols are spoken by name.',
  },
  ScrollArea: {
    props: z
      .strictObject({
        orientation: z.enum(['vertical', 'horizontal', 'both']).nullish(),
        /** px number or CSS length. */
        maxHeight: z.union([z.number(), z.string()]).nullish(),
        height: z.union([z.number(), z.string()]).nullish(),
        ariaLabel: z.string().nullish(),
      })
      .extend(host),
    slots: ['default'],
    events: [],
    description: 'Scrolls its children inside a fixed or maximum height with slim themed scrollbars, vertically, horizontally or both. The viewport takes keyboard focus; give `ariaLabel` to name it.',
  },
  Tag: {
    props: z
      .strictObject({
        label: z.string(),
        tone: tone.nullish(),
        appearance: z.enum(['soft', 'solid', 'outline']).nullish(),
        size: size.nullish(),
        icon: z.string().nullish(),
        /** Leads with an avatar; `name` gives the initials and spoken name. */
        avatar: z.strictObject({ name: z.string(), src: z.string().nullish() }).nullish(),
        dot: z.boolean().nullish(),
        closable: z.boolean().nullish(),
        /** A toggle chip: press flips the bound `checked`. */
        checkable: z.boolean().nullish(),
        checked: z.boolean().nullish(),
        disabled: z.boolean().nullish(),
      })
      .extend(host),
    slots: [],
    events: ['close', 'change'],
    description: 'A compact label for a category, person or filter, in the Badge tones and appearances. `closable` adds a remove button that emits `close`. `checkable` turns it into a toggle chip: bind `checked` ({ "$bindState": "/path" }); pressing flips it and emits `change`.',
  },
  TagGroup: {
    props: z
      .strictObject({
        value: z.array(optionValue).optional(),
        defaultValue: z.array(optionValue).optional(),
        /** Turns the group into selectable chips: each option toggles in `value`. */
        options: z.array(z.strictObject({
          label: z.string(),
          value: optionValue,
          tone: tone.nullish(),
          icon: z.string().nullish(),
          disabled: z.boolean().nullish(),
        })).nullish(),
        /** With `options`, false keeps at most one chip selected. */
        multiple: z.boolean().nullish(),
        /** Display labels for values without `options`. */
        labels: z.record(z.string(), z.string()).nullish(),
        tone: tone.nullish(),
        appearance: z.enum(['soft', 'solid', 'outline']).nullish(),
        size: size.nullish(),
        closable: z.boolean().nullish(),
        empty: z.string().nullish(),
        disabled: z.boolean().nullish(),
        ariaLabel: z.string().nullish(),
      })
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'A row of tags bound to an array. Without `options` each value is a closable tag and removing one updates `value`. With `options` the tags are selectable chips that toggle their value in `value` (one at most with `multiple: false`).',
  },
  Calendar: {
    props: z
      .strictObject({
        mode: z.enum(['single', 'range', 'multiple']).nullish(),
        /** `yyyy-MM-dd` for single, `[start, end]` for range, a date list for multiple. */
        value: z.union([z.null(), z.string(), dateList]).optional(),
        defaultValue: z.union([z.null(), z.string(), dateList]).optional(),
        min: z.string().nullish(),
        max: z.string().nullish(),
        /** Dates (`yyyy-MM-dd`) that cannot be picked. */
        disabledDates: dateList.nullish(),
        /** Weekdays that cannot be picked, 0 = Sunday. */
        disabledWeekdays: z.array(z.number().int().min(0).max(6)).nullish(),
        /** Event dots under a day, in a tone. */
        marks: z.array(z.strictObject({ date: z.string(), tone: tone.nullish(), label: z.string().nullish() })).nullish(),
        months: z.number().int().min(1).max(3).nullish(),
        /** The month shown first (`yyyy-MM` or a date) when there is no value. */
        month: z.string().nullish(),
        /** `panel`: the month caption switches to month and year grids; `label`: a plain caption. */
        captionLayout: z.enum(['panel', 'label']).nullish(),
        appearance: z.enum(['outline', 'plain']).nullish(),
        disabled: z.boolean().nullish(),
        readonly: z.boolean().nullish(),
        invalid: z.boolean().nullish(),
        ariaLabel: z.string().nullish(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'An inline month calendar bound to state. `mode` picks one date, a `[start, end]` range or several dates (all `yyyy-MM-dd`). `min`/`max`, `disabledDates` and `disabledWeekdays` block days; `marks` put tone dots under days with events. The month caption switches to month and year grids unless `captionLayout` is `label`.',
  },
  Listbox: {
    props: z
      .strictObject({
        value: z.union([z.null(), optionValue, z.array(optionValue)]).optional(),
        defaultValue: z.union([z.null(), optionValue, z.array(optionValue)]).optional(),
        options: z.array(z.strictObject({
          label: z.string(),
          value: optionValue,
          description: z.string().nullish(),
          icon: z.string().nullish(),
          disabled: z.boolean().nullish(),
          /** Options with the same group sit under one heading. */
          group: z.string().nullish(),
        })),
        multiple: z.boolean().nullish(),
        /** px; the list scrolls beyond it. */
        maxHeight: z.number().nullish(),
        empty: z.string().nullish(),
        disabled: z.boolean().nullish(),
        readonly: z.boolean().nullish(),
        invalid: z.boolean().nullish(),
        ariaLabel: z.string().nullish(),
      })
      .extend({ checks: z.array(ValidationCheckSchema).optional() })
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'An always-open list of options with icons, descriptions and group headings. Picks one value, or an array with `multiple`. Arrow keys, Home/End and type-ahead move; Space or Enter picks.',
  },
}
