'use client'

import { Checkbox as CheckboxPrimitive, RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import * as React from 'react'

import { CheckIcon } from '../icons.js'
import { cn } from './utils.js'

/**
 * A card-sized choice. Edge, surface and hover live in form-controls-plus.css:
 * checked takes a brand edge over a faint brand tint, the selection language of
 * tables and steppers; the mark in the corner stays a solid brand radio or checkbox.
 */
const CARD_CLASS = 'group/choice-card relative flex w-full min-w-0 items-start gap-3 rounded-control border p-(--lumi-choice-card-padding) text-start transition-[background-color,border-color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-readonly:cursor-default data-readonly:cursor-default'

const MARK_CLASS = 'mt-0.5 flex size-4 shrink-0 items-center justify-center border border-input bg-background text-brand-foreground transition-colors group-data-[state=checked]/choice-card:border-brand group-data-[state=checked]/choice-card:bg-brand dark:bg-input/30 dark:group-data-[state=checked]/choice-card:bg-brand'

function ChoiceCardGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>): React.ReactElement | null {
  return <RadioGroupPrimitive.Root data-slot="choice-cards" className={cn('grid gap-(--lumi-choice-card-gap)', className)} {...props} />
}

function ChoiceCardRadio({ className, children, indicator = true, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item> & { indicator?: boolean }): React.ReactElement | null {
  return (
    <RadioGroupPrimitive.Item data-slot="choice-card" className={cn(CARD_CLASS, className)} {...props}>
      {children}
      {indicator && (
        <span className={cn(MARK_CLASS, 'rounded-full')} data-slot="choice-card-mark" aria-hidden>
          <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-brand-foreground" />
        </span>
      )}
    </RadioGroupPrimitive.Item>
  )
}

function ChoiceCardCheckbox({ className, children, indicator = true, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root> & { indicator?: boolean }): React.ReactElement | null {
  return (
    <CheckboxPrimitive.Root data-slot="choice-card" className={cn(CARD_CLASS, className)} {...props}>
      {children}
      {indicator && (
        <span className={cn(MARK_CLASS, 'rounded-[4px]')} data-slot="choice-card-mark" aria-hidden>
          <CheckboxPrimitive.Indicator className="grid place-content-center [&>svg]:size-3.5">
            <CheckIcon />
          </CheckboxPrimitive.Indicator>
        </span>
      )}
    </CheckboxPrimitive.Root>
  )
}

export { ChoiceCardCheckbox, ChoiceCardGroup, ChoiceCardRadio }
