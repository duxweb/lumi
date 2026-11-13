import type { ReactElement, ReactNode } from 'react'
import type { KbdProps } from '../catalog/types-public.js'
import { Fragment } from 'react'
import { Kbd, KbdGroup } from '../internal/shadcn/kbd.js'
import { cn } from '../internal/utils.js'
import { useUiText } from './text.js'

interface HostProps { 'className'?: string, 'children'?: ReactNode, 'data-testid'?: string, 'aria-label'?: string }

// Glyphs a screen reader would skip or misread; each is spoken by name.
const KEY_NAMES: Record<string, [key: string, fallback: string]> = {
  '⌘': ['lumi.kbd.command', 'Command'],
  '⇧': ['lumi.kbd.shift', 'Shift'],
  '⌥': ['lumi.kbd.option', 'Option'],
  '⌃': ['lumi.kbd.control', 'Control'],
  '↵': ['lumi.kbd.enter', 'Enter'],
  '⏎': ['lumi.kbd.enter', 'Enter'],
  '⌫': ['lumi.kbd.backspace', 'Backspace'],
  '⎋': ['lumi.kbd.escape', 'Escape'],
  '⇥': ['lumi.kbd.tab', 'Tab'],
  '↑': ['lumi.kbd.up', 'Up arrow'],
  '↓': ['lumi.kbd.down', 'Down arrow'],
  '←': ['lumi.kbd.left', 'Left arrow'],
  '→': ['lumi.kbd.right', 'Right arrow'],
}

const KEY_SIZE = { sm: '', md: 'h-6 min-w-6 px-1.5 text-xs' } as const

/** A shortcut as key chips; a combination nests one `<kbd>` per key inside the group, as HTML specifies. */
export function LumiKbd(props: KbdProps & HostProps): ReactElement {
  const { t } = useUiText()
  const { keys, separator, size: sizeProp, className, children: _children, ...rest } = props
  const size = sizeProp ?? 'sm'
  return (
    <KbdGroup {...rest} data-size={size} className={cn('align-middle font-sans', className)}>
      {keys.map((key, index) => {
        const spoken = KEY_NAMES[key]
        return (
          // Keys repeat in sequences such as `G G`, so the index is part of the key.
          <Fragment key={`${index}:${key}`}>
            {index > 0 && separator && <span aria-hidden className="text-xs text-muted-foreground" data-slot="kbd-separator">{separator}</span>}
            <Kbd className={cn('leading-none tabular-nums', KEY_SIZE[size])}>
              {spoken
                ? (
                    <>
                      <span aria-hidden>{key}</span>
                      <span className="sr-only">{t(spoken[0], spoken[1])}</span>
                    </>
                  )
                : key}
            </Kbd>
          </Fragment>
        )
      })}
    </KbdGroup>
  )
}
