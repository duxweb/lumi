import type { z } from 'zod'
import type { formControlsPlusDefinitions } from './form-controls-plus.js'
import type { OptionValue } from './props.js'

type Definitions = typeof formControlsPlusDefinitions

export type SliderValue = number | number[]

export type SliderProps = z.input<Definitions['Slider']['props']> & {
  onChange?: ((value: SliderValue) => void) | undefined
}

export type ChoiceCardOption = z.input<Definitions['RadioCards']['props']>['options'][number]

export type RadioCardsProps = z.input<Definitions['RadioCards']['props']> & {
  onChange?: ((value: OptionValue) => void) | undefined
}

export type CheckboxCardsProps = z.input<Definitions['CheckboxCards']['props']> & {
  onChange?: ((value: OptionValue[]) => void) | undefined
}

export type TagSelectOption = z.input<Definitions['TagSelect']['props']>['options'][number]

export type TagSelectProps = z.input<Definitions['TagSelect']['props']> & {
  onChange?: ((value: OptionValue | OptionValue[] | null) => void) | undefined
}

export type RatingProps = z.input<Definitions['Rating']['props']> & {
  onChange?: ((value: number) => void) | undefined
}

export type ColorPickerProps = z.input<Definitions['ColorPicker']['props']> & {
  onChange?: ((value: string) => void) | undefined
}

export type ColorSwatch = z.input<Definitions['ColorSwatches']['props']>['swatches'][number]

export type ColorSwatchesProps = z.input<Definitions['ColorSwatches']['props']> & {
  onChange?: ((value: string) => void) | undefined
}

export type InputOTPProps = z.input<Definitions['InputOTP']['props']> & {
  onChange?: ((value: string) => void) | undefined
  /** Every box is filled. */
  onComplete?: ((value: string) => void) | undefined
}

export type SignaturePadProps = z.input<Definitions['SignaturePad']['props']> & {
  onChange?: ((value: string) => void) | undefined
}

export type IconPickerProps = z.input<Definitions['IconPicker']['props']> & {
  onChange?: ((value: string) => void) | undefined
}
