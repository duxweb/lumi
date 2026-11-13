import type { z } from 'zod'
import type { CodeEditorProps } from './code-props.js'
import type { uiComponentDefinitions } from './definitions.js'
import type { FilterModel } from './filter'
import type * as FormControlsPlus from './form-controls-plus-props.js'
import type { TextTranslator, TextValue } from './text'

type Sorter = NonNullable<z.input<typeof uiComponentDefinitions.Table.props>['sorters']>[number]

export const SIZES = ['sm', 'md', 'lg'] as const
/** `solid` is the neutral main action; `brand` is the theme-coloured emphasis action. */
export const BUTTON_APPEARANCES = ['solid', 'brand', 'soft', 'outline', 'ghost', 'link', 'danger'] as const
export const CONTROL_APPEARANCES = ['outline', 'filled'] as const
export const TONES = ['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const
/** Badges and activity feeds can also carry the brand colour; `Tone` stays the status set every toned surface styles. */
export const BADGE_TONES = [...TONES, 'brand'] as const
export const ALIGNS = ['left', 'center', 'right'] as const
export const FILTER_APPLY_MODES = ['immediate', 'explicit'] as const
export const ORIENTATIONS = ['horizontal', 'vertical'] as const
export const PROGRESS_STATUSES = ['complete', 'current', 'upcoming', 'loading', 'error'] as const

export type Size = typeof SIZES[number]
export type ButtonAppearance = typeof BUTTON_APPEARANCES[number]
export type ControlAppearance = typeof CONTROL_APPEARANCES[number]
export type Tone = typeof TONES[number]
export type BadgeTone = typeof BADGE_TONES[number]
export type Align = typeof ALIGNS[number]
export type FilterApplyMode = typeof FILTER_APPLY_MODES[number]
export type Orientation = typeof ORIENTATIONS[number]
export type ProgressStatus = typeof PROGRESS_STATUSES[number]
export type OptionValue = string | number | boolean

export interface Option {
  label: string
  value: OptionValue
  disabled?: boolean
  description?: string
  /** Round avatar image; an empty string shows the label's initials. */
  avatar?: string
  /** Square thumbnail image. */
  image?: string
}

export interface TableAction {
  value: string
  label: string
  icon?: string
  tone?: Tone
  disabled?: boolean
}

export interface TableColumn {
  field: string
  label?: string
  width?: string
  sortable?: boolean
  align?: Align
  /**
   * `code` is a machine identifier — a SKU, a reference, an id. It reads in a
   * monospace face and steps back, because nobody scans it for meaning; they
   * scan it for a match.
   */
  kind?: 'text' | 'code' | 'badge' | 'tags' | 'entity' | 'date' | 'datetime' | 'currency' | 'actions'
  valueMap?: Record<string, string>
  toneMap?: Record<string, BadgeTone>
  descriptionField?: string
  imageField?: string
  /**
   * Reads the displayed text from another field of the row while `field` keeps
   * the code that `toneMap` colours, e.g. `Overdue 26h` over an `overdue` state.
   */
  labelField?: string
  /**
   * Gives way first when the table is short of width: the cell ellipsizes and
   * carries its full text in `title`. Truncating columns share the width the
   * others leave, so give the fixed columns the room they need.
   */
  truncate?: boolean
  /**
   * Prose such as a description or a note wraps inside the column instead of
   * widening the table. Narrow tables keep it readable and scroll instead.
   */
  wrap?: boolean
  /** `entity` columns without an image lead with the name's initial in a disc. */
  initials?: boolean
  /** ISO 4217 code for `currency` columns. Without it the amount is formatted as a plain decimal. */
  currency?: string
  actions?: TableAction[]
}

export interface Tab {
  label: string
  value: string
  disabled?: boolean
  content?: string
}

export interface ControlState {
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  ariaLabel?: string
}

export interface NamedControl extends ControlState {
  name?: string
}

export interface InputControl extends NamedControl {
  placeholder?: string
  size?: Size
  appearance?: ControlAppearance
}
export type FragmentProps = z.input<typeof uiComponentDefinitions.Fragment.props> & {

}

export type ButtonProps = z.input<typeof uiComponentDefinitions.Button.props> & {
  onClick?: (() => void) | undefined
}

export type InputProps = z.input<typeof uiComponentDefinitions.Input.props> & {
  onChange?: ((value: string) => void) | undefined
}

export type TextareaProps = z.input<typeof uiComponentDefinitions.Textarea.props> & {
  onChange?: ((value: string) => void) | undefined
}

export type RichTextProps = z.input<typeof uiComponentDefinitions.RichText.props> & {
  onChange?: ((value: string) => void) | undefined
}

export type NumberInputProps = z.input<typeof uiComponentDefinitions.NumberInput.props> & {
  onChange?: ((value: number | null) => void) | undefined
}

/**
 * A host that searches remotely passes `onSearch` and gets the query instead
 * of local filtering; `onLoadMore` asks for the next page when `hasMore`.
 */
interface RemoteOptionCallbacks {
  onSearch?: ((query: string) => void) | undefined
  onLoadMore?: (() => void) | undefined
}

export type SelectProps = z.input<typeof uiComponentDefinitions.Select.props> & RemoteOptionCallbacks & {
  onChange?: ((value: OptionValue | null) => void) | undefined
}

export type MultiSelectProps = z.input<typeof uiComponentDefinitions.MultiSelect.props> & RemoteOptionCallbacks & {
  onChange?: ((value: OptionValue[]) => void) | undefined
}

export type AutoCompleteProps = z.input<typeof uiComponentDefinitions.AutoComplete.props> & Pick<RemoteOptionCallbacks, 'onSearch'> & {
  onChange?: ((value: string) => void) | undefined
  onSelect?: ((option: Option) => void) | undefined
}

export type MentionProps = z.input<typeof uiComponentDefinitions.Mention.props> & Pick<RemoteOptionCallbacks, 'onSearch'> & {
  onChange?: ((value: string) => void) | undefined
  onSelect?: ((option: Option) => void) | undefined
}

export type TransferProps = z.input<typeof uiComponentDefinitions.Transfer.props> & RemoteOptionCallbacks & {
  onChange?: ((value: OptionValue[]) => void) | undefined
}

export type CheckboxProps = z.input<typeof uiComponentDefinitions.Checkbox.props> & {
  onChange?: ((value: boolean) => void) | undefined
}

export type CheckboxGroupProps = z.input<typeof uiComponentDefinitions.CheckboxGroup.props> & {
  onChange?: ((value: OptionValue[]) => void) | undefined
}

export type RadioGroupProps = z.input<typeof uiComponentDefinitions.RadioGroup.props> & {
  onChange?: ((value: OptionValue) => void) | undefined
}

export type SwitchProps = z.input<typeof uiComponentDefinitions.Switch.props> & {
  onChange?: ((value: boolean) => void) | undefined
}

export type DatePickerProps = z.input<typeof uiComponentDefinitions.DatePicker.props> & {
  onChange?: ((value: string | null) => void) | undefined
}

/** A cascader node; `children` opens the next column. */
export interface CascaderOption {
  label: string
  value: OptionValue
  disabled?: boolean | undefined
  icon?: string | undefined
  /** With no `children`, a node that is not a leaf loads them through `onLoadChildren`. */
  isLeaf?: boolean | undefined
  children?: CascaderOption[] | undefined
}

/** Asks the host for a node's children; the host answers by updating the node in `options`/`items`. */
export type LoadChildren = (node: CascaderOption) => Promise<unknown> | void

export type CascaderProps = Omit<z.input<typeof uiComponentDefinitions.Cascader.props>, 'options'> & {
  options?: readonly CascaderOption[] | undefined
  onChange?: ((value: OptionValue[] | null) => void) | undefined
  onLoadChildren?: LoadChildren | undefined
}

export type TreeValue = OptionValue | OptionValue[] | null

export type TreeProps = Omit<z.input<typeof uiComponentDefinitions.Tree.props>, 'items'> & {
  items?: readonly CascaderOption[] | undefined
  onChange?: ((value: TreeValue) => void) | undefined
  onExpandedChange?: ((value: OptionValue[]) => void) | undefined
  onLoadChildren?: LoadChildren | undefined
  /** Search text for an external search box; replaces the built-in one. */
  query?: string | undefined
  onSearch?: ((query: string) => void) | undefined
}

export type TreeSelectProps = Omit<z.input<typeof uiComponentDefinitions.TreeSelect.props>, 'items'> & {
  items?: readonly CascaderOption[] | undefined
  onChange?: ((value: TreeValue) => void) | undefined
  onLoadChildren?: LoadChildren | undefined
  onSearch?: ((query: string) => void) | undefined
  /** Nodes known for the current value that are not loaded in `items` yet, so the trigger can name them. */
  selectedNodes?: readonly CascaderOption[] | undefined
}

export type CascaderPanelProps = Omit<z.input<typeof uiComponentDefinitions.CascaderPanel.props>, 'options'> & {
  options?: readonly CascaderOption[] | undefined
  onChange?: ((value: OptionValue[] | OptionValue[][] | null) => void) | undefined
  onLoadChildren?: LoadChildren | undefined
}

export type TimePickerProps = z.input<typeof uiComponentDefinitions.TimePicker.props> & {
  onChange?: ((value: string | null) => void) | undefined
}

export type DateTimePickerProps = z.input<typeof uiComponentDefinitions.DateTimePicker.props> & {
  onChange?: ((value: string | null) => void) | undefined
}

export type DateRangePickerProps = z.input<typeof uiComponentDefinitions.DateRangePicker.props> & {
  onChange?: ((value: string[] | null) => void) | undefined
}

export type FormProps = z.input<typeof uiComponentDefinitions.Form.props> & {
  onSubmit?: ((values: Record<string, unknown>) => void) | undefined
}

export type FormFieldProps = z.input<typeof uiComponentDefinitions.FormField.props> & {
  onChange?: ((value: unknown) => void) | undefined
}

export type TableProps = z.input<typeof uiComponentDefinitions.Table.props> & {
  onSort?: ((sorters: Sorter[]) => void) | undefined
  onRowClick?: ((row: Record<string, unknown>) => void) | undefined
  onRowAction?: ((value: { action: string, row: Record<string, unknown> }) => void) | undefined
  onSelectionChange?: ((keys: Array<string | number>) => void) | undefined
  onBulkAction?: ((value: { action: string, keys: Array<string | number> }) => void) | undefined
}

export interface DescriptionListItem {
  label: TextValue
  value: TextValue | number | boolean | null
}
export type DescriptionListProps = z.input<typeof uiComponentDefinitions.DescriptionList.props> & {

}

export type PaginationProps = z.input<typeof uiComponentDefinitions.Pagination.props> & {
  onPageChange?: ((page: number) => void) | undefined
  onPageSizeChange?: ((pageSize: number) => void) | undefined
}

export type DialogProps = z.input<typeof uiComponentDefinitions.Dialog.props> & {
  onOpenChange?: ((open: boolean) => void) | undefined
  onConfirm?: (() => void) | undefined
  onCancel?: (() => void) | undefined
}

export type DrawerProps = z.input<typeof uiComponentDefinitions.Drawer.props> & {
  onOpenChange?: ((open: boolean) => void) | undefined
}

export type CardProps = z.input<typeof uiComponentDefinitions.Card.props> & {

}

export type TabsProps = z.input<typeof uiComponentDefinitions.Tabs.props> & {
  onChange?: ((value: string) => void) | undefined
}

/** What a per-file upload reports back while it runs. */
export interface UploadFileContext {
  signal: AbortSignal
  onProgress: (percent: number) => void
}

export type UploadProps = z.input<typeof uiComponentDefinitions.Upload.props> & {
  onCancel?: () => void
  /** Uploads one batch and resolves its URLs; progress comes through `progress`. */
  onUpload?: ((files: File[]) => Promise<string[]>) | undefined
  /** Uploads one file with its own progress and cancellation; preferred over `onUpload`. */
  onUploadFile?: ((file: File, context: UploadFileContext) => Promise<string>) | undefined
  onChange?: ((value: string[]) => void) | undefined
}

export type TagsInputProps = z.input<typeof uiComponentDefinitions.TagsInput.props> & {
  onChange?: ((value: string[]) => void) | undefined
}

export interface ImageGridItem {
  url: string
  /** A smaller image for the tile; the viewer still opens `url`. */
  thumbnail?: string | undefined
  alt?: string | undefined
}

export type ImageGridProps = z.input<typeof uiComponentDefinitions.ImageGrid.props> & {
  onChange?: ((value: ImageGridItem[]) => void) | undefined
  onCancel?: () => void
  /** Uploads one batch and resolves its URLs; progress comes through `progress`. */
  onUpload?: ((files: File[]) => Promise<string[]>) | undefined
  /** Uploads one file with its own progress and cancellation; preferred over `onUpload`. */
  onUploadFile?: ((file: File, context: UploadFileContext) => Promise<string>) | undefined
  /** For a host that uploads by itself: the accepted files, after which it writes `value`. */
  onFiles?: ((files: File[]) => void) | undefined
}

export type RepeaterColumn = z.input<typeof uiComponentDefinitions.Repeater.props>['columns'][number]
export type RepeaterSummary = NonNullable<z.input<typeof uiComponentDefinitions.Repeater.props>['summary']>[number]

export type RepeaterProps = z.input<typeof uiComponentDefinitions.Repeater.props> & {
  onChange?: ((value: Record<string, unknown>[]) => void) | undefined
  /** Receives `errors` re-addressed after rows move, or with an edited cell's message dropped. */
  onErrorsChange?: ((errors: Record<string, string>) => void) | undefined
}

export type RepeaterRowProps = z.input<typeof uiComponentDefinitions.RepeaterRow.props> & {
  /** Position in the Repeater's rows; the JSON registry passes the repeat index. */
  index: number
}

export type BadgeProps = z.input<typeof uiComponentDefinitions.Badge.props> & {

}

export type TooltipProps = z.input<typeof uiComponentDefinitions.Tooltip.props>
export type MenuProps = z.input<typeof uiComponentDefinitions.Menu.props>
export type MenuItem = MenuProps['items'][number]
export type AccordionProps = z.input<typeof uiComponentDefinitions.Accordion.props>
export type AccordionItem = AccordionProps['items'][number]
export type PopoverProps = z.input<typeof uiComponentDefinitions.Popover.props> & {
  onOpenChange?: ((open: boolean) => void) | undefined
  onConfirm?: (() => void) | undefined
  onCancel?: (() => void) | undefined
}
export type PopconfirmProps = z.input<typeof uiComponentDefinitions.Popconfirm.props> & {
  onOpenChange?: ((open: boolean) => void) | undefined
  onConfirm?: (() => void) | undefined
  onCancel?: (() => void) | undefined
}
export type ImageProps = z.input<typeof uiComponentDefinitions.Image.props>
export type IframeProps = z.input<typeof uiComponentDefinitions.Iframe.props>
export type LightboxProps = z.input<typeof uiComponentDefinitions.Lightbox.props> & {
  onOpenChange?: ((open: boolean) => void) | undefined
  onIndexChange?: ((index: number) => void) | undefined
}
export type LightboxItem = LightboxProps['items'][number]
export type CarouselProps = z.input<typeof uiComponentDefinitions.Carousel.props> & {
  onChange?: ((index: number) => void) | undefined
}
export type CarouselItem = NonNullable<CarouselProps['items']>[number]
export type BreadcrumbProps = z.input<typeof uiComponentDefinitions.Breadcrumb.props> & {
  onSelect?: ((key: string) => void) | undefined
}
export type BreadcrumbItem = BreadcrumbProps['items'][number]

export type SkeletonProps = z.input<typeof uiComponentDefinitions.Skeleton.props>
export type SpinnerProps = z.input<typeof uiComponentDefinitions.Spinner.props>
export type LoadingProps = z.input<typeof uiComponentDefinitions.Loading.props>
export type EmptyProps = z.input<typeof uiComponentDefinitions.Empty.props>
/** A Table's `empty` in object form. */
export type EmptyContent = Exclude<NonNullable<TableProps['empty']>, string>
export type KbdProps = z.input<typeof uiComponentDefinitions.Kbd.props>
export type ScrollAreaProps = z.input<typeof uiComponentDefinitions.ScrollArea.props>
export type TagProps = z.input<typeof uiComponentDefinitions.Tag.props> & {
  onClose?: (() => void) | undefined
  onCheckedChange?: ((checked: boolean) => void) | undefined
}
export type TagGroupProps = z.input<typeof uiComponentDefinitions.TagGroup.props> & {
  onChange?: ((value: OptionValue[]) => void) | undefined
}
export type CalendarProps = z.input<typeof uiComponentDefinitions.Calendar.props> & {
  onChange?: ((value: string | string[] | null) => void) | undefined
}
export type ListboxOption = z.input<typeof uiComponentDefinitions.Listbox.props>['options'][number]
export type ListboxProps = z.input<typeof uiComponentDefinitions.Listbox.props> & {
  onChange?: ((value: OptionValue | OptionValue[] | null) => void) | undefined
}

export type AlertProps = z.input<typeof uiComponentDefinitions.Alert.props> & {
  onClose?: (() => void) | undefined
}

export type IconProps = z.input<typeof uiComponentDefinitions.Icon.props> & {

}

export type StackProps = z.input<typeof uiComponentDefinitions.Stack.props> & {

}

export type GridProps = z.input<typeof uiComponentDefinitions.Grid.props> & {

}

export type ProgressProps = z.input<typeof uiComponentDefinitions.Progress.props> & {

}

export type SeparatorProps = z.input<typeof uiComponentDefinitions.Separator.props> & {

}

export type HeadingProps = z.input<typeof uiComponentDefinitions.Heading.props> & {

}

export type TextProps = z.input<typeof uiComponentDefinitions.Text.props> & {

}

export type AvatarProps = z.input<typeof uiComponentDefinitions.Avatar.props> & {

}

export type AvatarGroupProps = z.input<typeof uiComponentDefinitions.AvatarGroup.props> & {

}

export type CodeBlockProps = z.input<typeof uiComponentDefinitions.CodeBlock.props> & {

}

export type ProseProps = z.input<typeof uiComponentDefinitions.Prose.props> & {

}

export type MarkdownProps = z.input<typeof uiComponentDefinitions.Markdown.props> & {

}

export type HtmlProps = z.input<typeof uiComponentDefinitions.Html.props> & {

}

export type FrameProps = z.input<typeof uiComponentDefinitions.Frame.props> & {

}

export type FiltersProps = z.input<typeof uiComponentDefinitions.Filters.props> & {
  translate?: TextTranslator | undefined
  onChange?: ((value: FilterModel) => void) | undefined
}

export interface StepperItem {
  key: string
  label: string
  description?: string
  status?: ProgressStatus
}
export type StepperProps = z.input<typeof uiComponentDefinitions.Stepper.props> & {
  onChange?: ((value: string) => void) | undefined
}

export interface TimelineItem {
  key: string
  title: string
  description?: string
  timestamp?: string
  tone?: BadgeTone
  status?: ProgressStatus
}
export type TimelineProps = z.input<typeof uiComponentDefinitions.Timeline.props> & {

}

export type ActivityFeedProps = z.input<typeof uiComponentDefinitions.ActivityFeed.props>
export type ActivityFeedItem = ActivityFeedProps['items'][number]

export interface CoreProps {
  Fragment: FragmentProps
  Button: ButtonProps
  Input: InputProps
  Textarea: TextareaProps
  RichText: RichTextProps
  NumberInput: NumberInputProps
  Select: SelectProps
  MultiSelect: MultiSelectProps
  Checkbox: CheckboxProps
  CheckboxGroup: CheckboxGroupProps
  RadioGroup: RadioGroupProps
  Switch: SwitchProps
  DatePicker: DatePickerProps
  Cascader: CascaderProps
  TimePicker: TimePickerProps
  DateTimePicker: DateTimePickerProps
  DateRangePicker: DateRangePickerProps
  Form: FormProps
  FormField: FormFieldProps
  Table: TableProps
  DescriptionList: DescriptionListProps
  Pagination: PaginationProps
  Dialog: DialogProps
  Drawer: DrawerProps
  Card: CardProps
  Tabs: TabsProps
  Upload: UploadProps
  Badge: BadgeProps
  Alert: AlertProps
}

export type CorePropsKey = keyof CoreProps

export interface ExtensionProps {
  Frame: FrameProps
  CodeBlock: CodeBlockProps
  CodeEditor: CodeEditorProps
  Prose: ProseProps
  Markdown: MarkdownProps
  Html: HtmlProps
  Avatar: AvatarProps
  AvatarGroup: AvatarGroupProps
  Text: TextProps
  Stack: StackProps
  Icon: IconProps
  Grid: GridProps
  Progress: ProgressProps
  Separator: SeparatorProps
  Heading: HeadingProps
  Filters: FiltersProps
  Stepper: StepperProps
  Timeline: TimelineProps
  ActivityFeed: ActivityFeedProps
  Tree: TreeProps
  TreeSelect: TreeSelectProps
  CascaderPanel: CascaderPanelProps
  TagsInput: TagsInputProps
  AutoComplete: AutoCompleteProps
  Mention: MentionProps
  Transfer: TransferProps
  ImageGrid: ImageGridProps
  Repeater: RepeaterProps
  RepeaterRow: RepeaterRowProps
  Tooltip: TooltipProps
  Menu: MenuProps
  Accordion: AccordionProps
  Popover: PopoverProps
  Popconfirm: PopconfirmProps
  Image: ImageProps
  Iframe: IframeProps
  Lightbox: LightboxProps
  Carousel: CarouselProps
  Breadcrumb: BreadcrumbProps
  Skeleton: SkeletonProps
  Spinner: SpinnerProps
  Loading: LoadingProps
  Empty: EmptyProps
  Kbd: KbdProps
  ScrollArea: ScrollAreaProps
  Tag: TagProps
  TagGroup: TagGroupProps
  Calendar: CalendarProps
  Listbox: ListboxProps
  Slider: FormControlsPlus.SliderProps
  RadioCards: FormControlsPlus.RadioCardsProps
  CheckboxCards: FormControlsPlus.CheckboxCardsProps
  TagSelect: FormControlsPlus.TagSelectProps
  Rating: FormControlsPlus.RatingProps
  ColorPicker: FormControlsPlus.ColorPickerProps
  ColorSwatches: FormControlsPlus.ColorSwatchesProps
  InputOTP: FormControlsPlus.InputOTPProps
  SignaturePad: FormControlsPlus.SignaturePadProps
  IconPicker: FormControlsPlus.IconPickerProps
}

export type ExtensionPropsKey = keyof ExtensionProps
export type ComponentProps = CoreProps & ExtensionProps
