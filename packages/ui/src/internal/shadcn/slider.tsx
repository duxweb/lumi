'use client'

import { Slider as SliderPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '../utils.js'

/** Root, track and range; thumbs are rendered by the caller so each can carry its own label and hint. */
function Slider({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>): React.ReactElement | null {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-input data-[orientation=horizontal]:h-(--lumi-slider-track) data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-(--lumi-slider-track)"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-brand data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      {children}
    </SliderPrimitive.Root>
  )
}

function SliderThumb({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Thumb>): React.ReactElement | null {
  return (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className={cn(
        'relative block size-(--lumi-slider-thumb) shrink-0 rounded-full border-2 border-brand bg-background ring-ring/50 transition-[color,box-shadow] outline-none hover:ring-4 focus-visible:ring-4 disabled:pointer-events-none',
        className,
      )}
      {...props}
    />
  )
}

export { Slider, SliderThumb }
