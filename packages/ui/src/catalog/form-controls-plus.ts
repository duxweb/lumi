import { ValidationCheckSchema } from '@json-render/core'
import { z } from 'zod'

const sizeSchema = z.union([z.literal('sm'), z.literal('md'), z.literal('lg')]).optional()
const appearanceSchema = z.union([z.literal('outline'), z.literal('filled')]).optional()
const optionValueSchema = z.union([z.string(), z.number(), z.boolean()])

/** The state every form control shares; `error` is shown under the control itself. */
const fieldState = {
  name: z.string().optional(),
  disabled: z.boolean().optional(),
  readonly: z.boolean().optional(),
  invalid: z.boolean().optional(),
  error: z.string().optional(),
  ariaLabel: z.string().optional(),
}

const checks = { checks: z.array(ValidationCheckSchema).optional() }

const host = {
  'className': z.string().optional(),
  'data-testid': z.string().optional(),
  'aria-label': z.string().optional(),
}

const choiceCardOptionSchema = z.strictObject({
  value: optionValueSchema,
  label: z.string(),
  description: z.string().optional(),
  /** A bundled Lumi name or any HugeIcons name. */
  icon: z.string().optional(),
  badge: z.string().optional(),
  /** Trailing text on the title row, such as a price. */
  extra: z.string().optional(),
  disabled: z.boolean().optional(),
})

const choiceCardsProps = {
  options: z.array(choiceCardOptionSchema),
  /** Most cards per row; rows hold fewer when cards would get narrower than their minimum width. Without it cards fill the row at that width. */
  columns: z.number().int().min(1).max(6).optional(),
  size: sizeSchema,
  /** Shows the radio or check mark in the card corner. Defaults to true. */
  indicator: z.boolean().optional(),
  ...fieldState,
}

export const formControlsPlusDefinitions = {
  Slider: {
    props: z
      .strictObject({
        value: z.union([z.number(), z.array(z.number())]).optional(),
        defaultValue: z.union([z.number(), z.array(z.number())]).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().positive().optional(),
        /** Two thumbs; the value is `[start, end]`. */
        range: z.boolean().optional(),
        /** Closest the two range thumbs may come, in steps. */
        minStepsBetweenThumbs: z.number().int().min(0).optional(),
        marks: z.array(z.strictObject({ value: z.number(), label: z.string().optional() })).optional(),
        /** Shows the value over the thumb while it is dragged, hovered or focused. Defaults to true. */
        tooltip: z.boolean().optional(),
        /** Adds number inputs beside the track that edit the same value. */
        input: z.boolean().optional(),
        orientation: z.union([z.literal('horizontal'), z.literal('vertical')]).optional(),
        prefix: z.string().optional(),
        suffix: z.string().optional(),
        size: sizeSchema,
        ...fieldState,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'Picks a number, or a `[start, end]` range with `range`, by dragging along a track. Supports `step`, labelled `marks`, a value tooltip, number inputs beside the track and a vertical orientation. Arrow keys, Page Up/Down, Home and End move the focused thumb.',
  },
  RadioCards: {
    props: z
      .strictObject({
        value: optionValueSchema.optional(),
        defaultValue: optionValueSchema.optional(),
        ...choiceCardsProps,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'Picks one option shown as a card with an icon, title, description and optional badge or trailing text (a price). Arrow keys move between cards. Suits plans, shipping methods and other choices that need explaining.',
  },
  CheckboxCards: {
    props: z
      .strictObject({
        value: z.array(optionValueSchema).optional(),
        defaultValue: z.array(optionValueSchema).optional(),
        ...choiceCardsProps,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'Picks several options shown as cards with an icon, title, description and optional badge or trailing text. The value is an array of option values.',
  },
  TagSelect: {
    props: z
      .strictObject({
        value: z.union([z.null(), optionValueSchema, z.array(optionValueSchema)]).optional(),
        defaultValue: z.union([z.null(), optionValueSchema, z.array(optionValueSchema)]).optional(),
        options: z.array(z.strictObject({
          value: optionValueSchema,
          label: z.string(),
          icon: z.string().optional(),
          /** A count shown after the label, e.g. matching records. */
          count: z.number().optional(),
          disabled: z.boolean().optional(),
        })),
        /** Several tags at once; the value is an array. */
        multiple: z.boolean().optional(),
        /** Single mode only: pressing the chosen tag again clears the value to null. */
        clearable: z.boolean().optional(),
        size: sizeSchema,
        ...fieldState,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'A compact row of checkable tags for filters: one value, or several with `multiple`. Chosen tags are filled like filter chips.',
  },
  Rating: {
    props: z
      .strictObject({
        value: z.number().optional(),
        defaultValue: z.number().optional(),
        /** Number of icons. Defaults to 5. */
        count: z.number().int().min(1).max(20).optional(),
        /** Allows half steps. */
        allowHalf: z.boolean().optional(),
        /** Any HugeIcons name; defaults to a star. */
        icon: z.string().optional(),
        /** Pressing the current value again, or Delete, sets 0. */
        clearable: z.boolean().optional(),
        tone: z.union([z.literal('warning'), z.literal('brand')]).optional(),
        size: sizeSchema,
        ...fieldState,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'A score as a row of stars or another icon, with optional half steps. `readonly` turns it into a display. Arrow keys change the value; Home and End jump to the ends.',
  },
  ColorPicker: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        /** Hex colors offered as swatches; defaults to the theme chart colors. */
        presets: z.array(z.string()).optional(),
        clearable: z.boolean().optional(),
        placeholder: z.string().optional(),
        size: sizeSchema,
        appearance: appearanceSchema,
        ...fieldState,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'Picks a color as a `#rrggbb` hex string from a saturation/brightness area and hue strip, preset swatches, a hex field or, where the browser has one, the eyedropper. Empty is the empty string.',
  },
  ColorSwatches: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        /** Hex colors, or `{ value, label }` to give a swatch a spoken name such as "Ocean". */
        swatches: z.array(z.union([z.string(), z.strictObject({ value: z.string(), label: z.string() })])),
        size: sizeSchema,
        shape: z.union([z.literal('circle'), z.literal('square')]).optional(),
        /** Ends the row with a + tile that opens the full color picker; the picked color joins the row, selected. */
        allowCustom: z.boolean().optional(),
        /** Starts the row with a "no color" swatch whose value is the empty string. */
        clearable: z.boolean().optional(),
        ...fieldState,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'Picks a color from an inline row of swatches, a radio group: arrow keys move and select, the chosen swatch shows a check and a ring in its own color. The value is a `#rrggbb` hex string; empty is the empty string. `clearable` adds a "no color" swatch and `allowCustom` a + tile that opens the full ColorPicker panel. Use it for a short palette such as tag or theme colors; use ColorPicker for any color in a compact field.',
  },
  InputOTP: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        /** Number of boxes. Defaults to 6. */
        length: z.number().int().min(1).max(12).optional(),
        /** `numeric` (default) accepts digits; `alphanumeric` accepts letters and digits. */
        type: z.union([z.literal('numeric'), z.literal('alphanumeric')]).optional(),
        /** Hides the entered characters. */
        mask: z.boolean().optional(),
        /** Draws a separator after every N boxes, e.g. 3 for `123-456`. */
        group: z.number().int().min(1).optional(),
        size: sizeSchema,
        ...fieldState,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change', 'complete'],
    description: 'A one-time code in separate boxes. Typing advances, Backspace steps back, arrows move and a pasted code fills every box. Emits `complete` once all boxes are filled.',
  },
  SignaturePad: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        /** Drawing height in pixels. Defaults to 160. */
        height: z.number().int().min(60).max(600).optional(),
        /** Ink color. Without it the ink follows the text color and is saved black. */
        penColor: z.string().optional(),
        placeholder: z.string().optional(),
        ...fieldState,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'Draws a signature with a pointer, pen or finger. The value is a PNG data URL, empty when cleared; Undo removes the last stroke. The pad takes its container\'s width.',
  },
  IconPicker: {
    props: z
      .strictObject({
        value: z.string().optional(),
        defaultValue: z.string().optional(),
        placeholder: z.string().optional(),
        clearable: z.boolean().optional(),
        size: sizeSchema,
        appearance: appearanceSchema,
        ...fieldState,
      })
      .extend(checks)
      .extend(host),
    slots: [],
    events: ['change'],
    description: 'Picks a HugeIcons icon by name (e.g. `delivery-truck-01`) from a searchable grid. The icon set loads on first open. The value is the name an Icon or Button `icon` accepts.',
  },
}
