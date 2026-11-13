import type { ChangeEvent, KeyboardEvent, ReactElement, ReactNode, Ref, RefObject } from 'react'
import type { AgentAttachment, AgentCommand, AgentContextItem, AgentPromptMentions, PromptInputProps } from '../../catalog/types-public.js'
import { DropdownMenu as MenuPrimitive } from 'radix-ui'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircleIcon, ArrowUpStemIcon, CheckIcon, ChevronDownIcon, XIcon } from '../../icons.js'
import { formatFileSize } from '../../internal/file-size.js'
import { POPOVER_LAYER } from '../../internal/layers.js'
import { Popover, PopoverAnchor, PopoverContent } from '../../internal/shadcn/popover.js'
import { cn } from '../../internal/utils.js'
import { MENU_PANEL_CLASS, OPTION_CLASS, useControllableValue } from '../control.js'
import { SpinnerGlyph } from '../spinner.js'
import { useUiText } from '../text.js'
import { ContextChip } from './context-chips.js'
import { LumiAgentMentionPicker, MentionTabCycleContext } from './mention-picker.js'
import { AtIcon, AttachmentIcon, FlashIcon, KindIcon, ShieldIcon } from './shared.js'

interface HostProps { 'className'?: string, 'data-testid'?: string, 'aria-label'?: string, 'children'?: ReactNode }

/** What the @ picker over the composer is given; a host with remote results draws its own. */
export interface PromptMentionPickerProps {
  mentions: AgentPromptMentions
  /** The composer's context: the picker marks what is already referenced. */
  value: AgentContextItem[]
  /** The context after a pick; the composer then closes the picker. */
  onChange: (value: AgentContextItem[]) => void
}

export interface LumiPromptInputProps extends PromptInputProps, HostProps {
  /** Shows the attach button and calls this instead of opening a file picker. */
  onAttachClick?: (() => void) | undefined
  textareaRef?: Ref<HTMLTextAreaElement> | undefined
  /** Draws the @ picker, e.g. one that searches a backend; defaults to the static `mentions.options`. */
  mentionPicker?: ((props: PromptMentionPickerProps) => ReactNode) | undefined
}

const MENU_WIDTH = { width: 'var(--radix-popper-anchor-width)' }
const SPACE_RE = /\s/
const COMMAND_DRAFT_RE = /^\/[\w.-]*$/

function StaticMentionPicker({ mentions, value, onChange }: PromptMentionPickerProps): ReactElement {
  return <LumiAgentMentionPicker types={mentions.types} options={mentions.options} placeholder={mentions.placeholder} value={value} multiple maxHeight={280} onChange={onChange} />
}

/** Where the @ just typed before `caret` sits, when it starts a word. */
function typedMention(text: string, caret: number): number | null {
  const at = caret - 1
  return text[at] === '@' && (at === 0 || SPACE_RE.test(text[at - 1]!)) ? at : null
}

/** The commands matching a box that holds only `/` and part of a name. */
function matchCommands(commands: readonly AgentCommand[] | undefined, draft: string): AgentCommand[] {
  if (!commands?.length || !COMMAND_DRAFT_RE.test(draft))
    return []
  const query = draft.slice(1).toLowerCase()
  return commands.filter(command => command.value.toLowerCase().includes(query) || command.label.toLowerCase().includes(query))
}

function AttachmentChip({ file, onRemove }: { file: AgentAttachment, onRemove?: (() => void) | undefined }): ReactElement {
  const { t } = useUiText()
  const image = file.url && file.mediaType?.startsWith('image/')
  return (
    <span className="lumi-agent-chip" data-slot="attachment-chip" data-status={file.status} title={file.name}>
      {file.status === 'uploading'
        ? <SpinnerGlyph size="sm" tone="muted" />
        : file.status === 'error'
          ? <AlertCircleIcon aria-hidden className="lumi-agent-chip-icon" data-tone="danger" />
          : image
            ? <img className="lumi-agent-chip-thumb" src={file.url} alt="" />
            : <KindIcon mediaType={file.mediaType ?? 'application/octet-stream'} className="lumi-agent-chip-icon" />}
      <span className="lumi-agent-chip-label">{file.name}</span>
      {file.size !== undefined && <span className="lumi-agent-chip-meta">{formatFileSize(file.size)}</span>}
      {file.status === 'uploading' && <span className="sr-only">{t('lumi.common.uploading', 'Uploading...')}</span>}
      {onRemove && (
        <button type="button" className="lumi-agent-chip-remove" data-hit-area="" aria-label={t('lumi.common.removeItem', 'Remove {name}', { name: file.name })} onClick={onRemove}>
          <XIcon aria-hidden />
        </button>
      )}
    </span>
  )
}

function ModelPicker({ value, models, disabled, onChange }: { value?: string | undefined, models: NonNullable<PromptInputProps['models']>, disabled?: boolean | undefined, onChange: (value: string) => void }): ReactElement {
  const { t } = useUiText()
  const current = models.find(model => model.value === value) ?? models[0]
  return (
    <MenuPrimitive.Root modal={false}>
      <MenuPrimitive.Trigger asChild disabled={disabled}>
        <button type="button" className="lumi-agent-model" aria-label={t('lumi.agent.model', 'Model: {name}', { name: current?.label ?? '' })} data-slot="prompt-model">
          <span>{current?.label}</span>
          <ChevronDownIcon aria-hidden />
        </button>
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          data-slot="menu"
          align="start"
          side="top"
          sideOffset={6}
          style={POPOVER_LAYER}
          className={cn('flex flex-col rounded-overlay text-popover-foreground outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95', MENU_PANEL_CLASS)}
        >
          <MenuPrimitive.RadioGroup value={current?.value} onValueChange={onChange}>
            {models.map(model => (
              <MenuPrimitive.RadioItem
                key={model.value}
                value={model.value}
                data-slot="menu-item"
                className={cn(OPTION_CLASS, 'h-auto min-h-control-md cursor-default py-1.5 data-[highlighted]:bg-hover data-[highlighted]:text-hover-foreground')}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{model.label}</span>
                  {model.description && <span className="truncate text-[length:var(--lumi-fs-caption)] text-muted-foreground">{model.description}</span>}
                </span>
                <MenuPrimitive.ItemIndicator><CheckIcon aria-hidden className="size-4 text-brand" /></MenuPrimitive.ItemIndicator>
              </MenuPrimitive.RadioItem>
            ))}
          </MenuPrimitive.RadioGroup>
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

/** The approval switch: ask before changes, or full access. */
function ApprovalModePicker({ value, disabled, onChange }: { value: 'ask' | 'auto', disabled?: boolean | undefined, onChange: (mode: 'ask' | 'auto') => void }): ReactElement {
  const { t } = useUiText()
  const modes = [
    { value: 'ask' as const, icon: <ShieldIcon aria-hidden />, label: t('lumi.agent.approvalAsk', 'Ask every time'), description: t('lumi.agent.approvalAskHint', 'Changes wait for your approval') },
    { value: 'auto' as const, icon: <FlashIcon aria-hidden />, label: t('lumi.agent.approvalAuto', 'Full access'), description: t('lumi.agent.approvalAutoHint', 'The agent acts without asking') },
  ]
  const current = modes.find(mode => mode.value === value) ?? modes[0]!
  return (
    <MenuPrimitive.Root modal={false}>
      <MenuPrimitive.Trigger asChild disabled={disabled}>
        <button type="button" className="lumi-agent-model lumi-agent-approval-mode" data-mode={current.value} aria-label={t('lumi.agent.approvalMode', 'Permissions: {name}', { name: current.label })} data-slot="prompt-approval-mode">
          {current.icon}
          <span>{current.label}</span>
          <ChevronDownIcon aria-hidden />
        </button>
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          data-slot="menu"
          align="start"
          side="top"
          sideOffset={6}
          style={POPOVER_LAYER}
          className={cn('flex flex-col rounded-overlay text-popover-foreground outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95', MENU_PANEL_CLASS)}
        >
          <MenuPrimitive.RadioGroup value={current.value} onValueChange={next => onChange(next === 'auto' ? 'auto' : 'ask')}>
            {modes.map(mode => (
              <MenuPrimitive.RadioItem
                key={mode.value}
                value={mode.value}
                data-slot="menu-item"
                className={cn(OPTION_CLASS, 'h-auto min-h-control-md cursor-default gap-2.5 py-1.5 data-[highlighted]:bg-hover data-[highlighted]:text-hover-foreground [&>svg:first-child]:size-4 [&>svg:first-child]:shrink-0')}
              >
                {mode.icon}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{mode.label}</span>
                  <span className="truncate text-[length:var(--lumi-fs-caption)] text-muted-foreground">{mode.description}</span>
                </span>
                <MenuPrimitive.ItemIndicator><CheckIcon aria-hidden className="size-4 text-brand" /></MenuPrimitive.ItemIndicator>
              </MenuPrimitive.RadioItem>
            ))}
          </MenuPrimitive.RadioGroup>
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

/**
 * A chat message box. It grows with its text up to `maxRows`, sends on Enter
 * (Shift+Enter adds a line, and Enter that confirms an input method
 * composition never sends) and turns its send button into stop while a
 * reply streams.
 */
export function LumiPromptInput(props: LumiPromptInputProps): ReactElement {
  const { t } = useUiText()
  const { value, placeholder, streaming, disabled, attachments, context, attachable: _attachable, mentionable: _mentionable, mentions, commands, command: _command, approvalMode, model, models, suggestions, maxRows = 8, ariaLabel, onChange, onSubmit, onStop, onAttach, onAttachClick, onMention, onAttachmentsChange, onContextChange, onModelChange, onSuggestion, onCommand, onApprovalModeChange, mentionPicker = StaticMentionPicker, textareaRef, className, children, ...rest } = props
  const [text, setText] = useControllableValue(value, '', onChange)
  const area = useRef<HTMLTextAreaElement | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const draft = text ?? ''
  const canSend = !disabled && !streaming && Boolean(draft.trim() || attachments?.length)
  const menuId = useId()

  // @ references: the picker opens from the button, or from an @ typed at the start of a word.
  const referencing = Boolean(mentions && onContextChange)
  const [mentionOpen, setMentionOpen] = useState(false)
  const typedAt = useRef<number | null>(null)
  const caretAfter = useRef<number | null>(null)
  const openMention = (at: number | null): void => {
    typedAt.current = at
    caretAfter.current = at === null ? null : at + 1
    setMentionOpen(true)
  }
  const pickMention = (next: AgentContextItem[]): void => {
    onContextChange?.(next)
    const at = typedAt.current
    // The typed @ only summoned the picker; the pick stands in for it as a chip.
    if (at !== null && draft[at] === '@') {
      setText(draft.slice(0, at) + draft.slice(at + 1))
      caretAfter.current = at
    }
    typedAt.current = null
    setMentionOpen(false)
  }

  // Slash commands, offered while the box holds only `/` and part of a name.
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [activeCommand, setActiveCommand] = useState(0)
  const shownCommands = disabled || dismissed === draft ? [] : matchCommands(commands, draft)
  const commandOpen = shownCommands.length > 0 && !mentionOpen
  const active = Math.min(activeCommand, Math.max(shownCommands.length - 1, 0))
  useEffect(() => setActiveCommand(0), [draft])
  const runCommand = (picked: AgentCommand): void => {
    if (picked.prompt) {
      setText(picked.prompt)
    }
    else {
      setText('')
      onCommand?.(picked)
    }
    area.current?.focus()
  }

  useLayoutEffect(() => {
    const element = area.current
    if (!element)
      return
    element.style.height = 'auto'
    const style = getComputedStyle(element)
    const line = Number.parseFloat(style.lineHeight) || 20
    const limit = line * maxRows + Number.parseFloat(style.paddingTop || '0') + Number.parseFloat(style.paddingBottom || '0')
    element.style.height = `${Math.min(element.scrollHeight, limit)}px`
    element.style.overflowY = element.scrollHeight > limit ? 'auto' : 'hidden'
  }, [draft, maxRows])

  const send = (): void => {
    if (canSend)
      onSubmit?.(draft.trim())
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const composing = event.nativeEvent.isComposing || event.keyCode === 229
    if (commandOpen && !composing) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActiveCommand((active + step + shownCommands.length) % shownCommands.length)
        return
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault()
        runCommand(shownCommands[active]!)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissed(draft)
        return
      }
    }
    if (event.key !== 'Enter' || event.shiftKey || composing)
      return
    event.preventDefault()
    send()
  }
  const onTextChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    const element = event.target
    setText(element.value)
    if (!referencing || (event.nativeEvent as InputEvent).data !== '@')
      return
    const at = typedMention(element.value, element.selectionStart)
    if (at !== null)
      openMention(at)
  }
  // A button shows only when pressing it does something.
  const showAttach = Boolean(onAttachClick || onAttach)
  const showMention = Boolean(onMention || referencing)
  const anchor = box as RefObject<HTMLDivElement>
  const chips = Boolean(context?.length || attachments?.length)
  const setRef = (element: HTMLTextAreaElement | null): void => {
    area.current = element
    if (typeof textareaRef === 'function')
      textareaRef(element)
    else if (textareaRef)
      (textareaRef as { current: HTMLTextAreaElement | null }).current = element
  }

  return (
    <div {...rest} className={cn('lumi-agent-prompt', className)} data-slot="prompt-input" data-streaming={streaming || undefined}>
      {suggestions?.length && !draft
        ? (
            <div className="lumi-agent-suggestions" role="group" aria-label={t('lumi.agent.suggestions', 'Suggestions')}>
              {suggestions.map(suggestion => (
                <button
                  key={suggestion.id ?? suggestion.label}
                  type="button"
                  className="lumi-agent-suggestion"
                  disabled={disabled}
                  onClick={() => {
                    if (onSuggestion) {
                      onSuggestion(suggestion)
                      return
                    }
                    setText(suggestion.prompt ?? suggestion.label)
                    area.current?.focus()
                  }}
                >
                  {suggestion.icon && <KindIcon icon={suggestion.icon} className="lumi-agent-chip-icon" />}
                  {suggestion.label}
                </button>
              ))}
            </div>
          )
        : null}
      <Popover
        open={mentionOpen}
        onOpenChange={(open) => {
          if (!open) {
            typedAt.current = null
            setMentionOpen(false)
          }
        }}
      >
        <PopoverAnchor virtualRef={anchor} />
        {mentions && (
          <PopoverContent
            side="top"
            align="start"
            sideOffset={6}
            className="w-auto gap-0 p-0"
            style={MENU_WIDTH}
            data-slot="prompt-mention"
            onCloseAutoFocus={(event) => {
              // Back to the text: after the typed @, where the pick removed it, or at the end.
              event.preventDefault()
              const element = area.current
              if (!element)
                return
              element.focus()
              const at = caretAfter.current ?? element.value.length
              element.setSelectionRange(at, at)
              caretAfter.current = null
            }}
          >
            {/* Escape closes this menu, so Tab may cycle the picker's kinds here. */}
            <MentionTabCycleContext.Provider value>
              {mentionPicker({ mentions, value: context ?? [], onChange: pickMention })}
            </MentionTabCycleContext.Provider>
          </PopoverContent>
        )}
      </Popover>
      <Popover open={commandOpen} onOpenChange={open => !open && setDismissed(draft)}>
        <PopoverAnchor virtualRef={anchor} />
        <PopoverContent
          side="top"
          align="start"
          sideOffset={6}
          className="w-auto gap-0 p-1"
          style={MENU_WIDTH}
          data-slot="prompt-commands"
          onOpenAutoFocus={event => event.preventDefault()}
          onCloseAutoFocus={event => event.preventDefault()}
          onInteractOutside={(event) => {
            // Typing goes on in the box, so pressing it keeps the list open.
            if (box.current?.contains(event.target as Node))
              event.preventDefault()
          }}
        >
          <ul id={menuId} role="listbox" aria-label={t('lumi.agent.commands', 'Commands')} className="lumi-agent-commands">
            {shownCommands.map((entry, index) => (
              <li
                key={entry.value}
                id={`${menuId}-${index}`}
                role="option"
                aria-selected={index === active}
                data-active={index === active || undefined}
                className="lumi-agent-command"
                onMouseMove={() => setActiveCommand(index)}
                onMouseDown={event => event.preventDefault()}
                onClick={() => runCommand(entry)}
              >
                <span className="lumi-agent-command-mark" aria-hidden>
                  {entry.icon ? <KindIcon icon={entry.icon} className="lumi-agent-chip-icon" /> : '/'}
                </span>
                <span className="lumi-agent-command-copy">
                  <span className="lumi-agent-command-label">{entry.label}</span>
                  {entry.description && <span className="lumi-agent-command-meta">{entry.description}</span>}
                </span>
                <span className="lumi-agent-command-name">{`/${entry.value}`}</span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <div
        ref={box}
        className="lumi-agent-prompt-box"
        data-disabled={disabled || undefined}
        onMouseDown={(event) => {
          // Pressing the box's padding focuses the text, like a single field.
          if (event.target === event.currentTarget) {
            event.preventDefault()
            area.current?.focus()
          }
        }}
      >
        {chips && (
          <ul className="lumi-agent-chips" aria-label={t('lumi.agent.attached', 'Attached')}>
            {context?.map(item => (
              <li key={`context:${item.id}`}>
                <ContextChip item={item} onRemove={onContextChange && !disabled ? () => onContextChange(context.filter(entry => entry.id !== item.id)) : undefined} />
              </li>
            ))}
            {attachments?.map(file => (
              <li key={`file:${file.id}`}>
                <AttachmentChip file={file} onRemove={onAttachmentsChange && !disabled ? () => onAttachmentsChange(attachments.filter(entry => entry.id !== file.id)) : undefined} />
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={setRef}
          className="lumi-agent-prompt-text"
          value={draft}
          rows={1}
          placeholder={placeholder ?? t('lumi.agent.placeholder', 'Ask anything')}
          aria-label={ariaLabel ?? t('lumi.agent.message', 'Message')}
          disabled={disabled}
          aria-autocomplete={commands?.length ? 'list' : undefined}
          aria-controls={commandOpen ? menuId : undefined}
          aria-activedescendant={commandOpen ? `${menuId}-${active}` : undefined}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
        />
        <div className="lumi-agent-prompt-bar">
          {showAttach && (
            <>
              <button
                type="button"
                className="lumi-agent-icon-button"
                aria-label={t('lumi.agent.attach', 'Attach files')}
                title={t('lumi.agent.attach', 'Attach files')}
                disabled={disabled}
                onClick={() => (onAttachClick ? onAttachClick() : picker.current?.click())}
              >
                <AttachmentIcon aria-hidden />
              </button>
              {onAttach && !onAttachClick && (
                <input
                  ref={picker}
                  type="file"
                  multiple
                  hidden
                  aria-hidden
                  tabIndex={-1}
                  onChange={(event) => {
                    const picked = Array.from(event.target.files ?? [])
                    if (picked.length)
                      onAttach(picked)
                    event.target.value = ''
                  }}
                />
              )}
            </>
          )}
          {showMention && (
            <button type="button" className="lumi-agent-icon-button" aria-label={t('lumi.agent.mention', 'Reference a page or record')} title={t('lumi.agent.mention', 'Reference a page or record')} disabled={disabled} aria-haspopup={referencing ? 'dialog' : undefined} aria-expanded={referencing ? mentionOpen : undefined} onClick={() => (referencing ? openMention(null) : onMention?.())}>
              <AtIcon aria-hidden />
            </button>
          )}
          {models?.length ? <ModelPicker value={model} models={models} disabled={disabled} onChange={next => onModelChange?.(next)} /> : null}
          {approvalMode ? <ApprovalModePicker value={approvalMode} disabled={disabled} onChange={next => onApprovalModeChange?.(next)} /> : null}
          {children}
          <span className="lumi-agent-spacer" />
          {streaming && onStop
            ? (
                <button type="button" className="lumi-agent-send" data-slot="prompt-stop" aria-label={t('lumi.agent.stop', 'Stop generating')} title={t('lumi.agent.stop', 'Stop generating')} onClick={onStop}>
                  <span className="lumi-agent-stop-glyph" aria-hidden />
                </button>
              )
            : (
                <button type="button" className="lumi-agent-send" data-slot="prompt-send" aria-label={t('lumi.agent.send', 'Send')} title={t('lumi.agent.send', 'Send')} disabled={!canSend} onClick={send}>
                  <ArrowUpStemIcon aria-hidden />
                </button>
              )}
        </div>
      </div>
    </div>
  )
}
