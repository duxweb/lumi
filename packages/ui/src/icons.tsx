import type { HugeiconsIconProps, IconSvgElement } from '@hugeicons/react'
import type { ForwardRefExoticComponent, ReactElement, RefAttributes } from 'react'
import {
  Activity01Icon as ActivityData,
  Add01Icon as AddData,
  AlertCircleIcon as AlertCircleData,
  Analytics01Icon as AnalyticsData,
  ArrowDownIcon as ArrowDownData,
  ArrowDown02Icon as ArrowDownStemData,
  ArrowDownToLineIcon as ArrowDownToLineData,
  ArrowUpIcon as ArrowUpData,
  ArrowUpDownIcon as ArrowUpDownData,
  ArrowUp02Icon as ArrowUpStemData,
  BoldIcon as BoldData,
  CalendarIcon as CalendarData,
  CheckmarkCircle02Icon as CheckCircleData,
  CheckIcon as CheckData,
  ChevronDownIcon as ChevronDownData,
  ChevronLeftIcon as ChevronLeftData,
  ChevronRightIcon as ChevronRightData,
  ChevronUpIcon as ChevronUpData,
  Clock01Icon as ClockData,
  CloudUploadIcon as CloudUploadData,
  Copy01Icon as CopyData,
  CornerDownRightIcon as CornerDownRightData,
  Download01Icon as DownloadData,
  DragDropVerticalIcon as DragHandleData,
  EyeIcon as EyeData,
  ColorPickerIcon as EyedropperData,
  File01Icon as FileData,
  FilterIcon as FilterData,
  Heading02Icon as Heading2Data,
  HelpCircleIcon as HelpCircleData,
  Image01Icon as ImageData,
  ImageNotFound01Icon as ImageOffData,
  InboxIcon as InboxData,
  InfoIcon as InfoData,
  ItalicIcon as ItalicData,
  LinkIcon as LinkData,
  ListIcon as ListData,
  Loading03Icon as Loader2Data,
  MoreHorizontalIcon as MoreHorizontalData,
  PauseIcon as PauseData,
  PencilEdit01Icon as PencilData,
  PlayIcon as PlayData,
  PrinterIcon as PrinterData,
  RefreshIcon as RefreshData,
  Search01Icon as SearchData,
  SearchRemoveIcon as SearchRemoveData,
  SlidersHorizontalIcon as SlidersHorizontalData,
  SparklesIcon as SparklesData,
  StarIcon as StarData,
  Delete02Icon as TrashData,
  DeliveryTruck01Icon as TruckData,
  ArrowTurnBackwardIcon as UndoData,
  UploadIcon as UploadData,
  Alert02Icon as WarningData,
  XIcon as XData,
  SearchAddIcon as ZoomInData,
  SearchMinusIcon as ZoomOutData,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { forwardRef, useEffect, useState } from 'react'

export type OutlineIconProps = Omit<HugeiconsIconProps, 'altIcon' | 'icon' | 'strokeWidth'>
export type OutlineIconComponent = ForwardRefExoticComponent<OutlineIconProps & RefAttributes<SVGSVGElement>>

export function createOutlineIcon(icon: IconSvgElement): OutlineIconComponent {
  return forwardRef<SVGSVGElement, OutlineIconProps>((props, ref) => <HugeiconsIcon {...props} ref={ref} data-lumi-icon="hugeicons" icon={icon} strokeWidth={1.5} />)
}

export const ActivityIcon = createOutlineIcon(ActivityData)
export const AlertCircleIcon = createOutlineIcon(AlertCircleData)
export const AddIcon = createOutlineIcon(AddData)
export const AnalyticsIcon = createOutlineIcon(AnalyticsData)
export const ArrowDownIcon = createOutlineIcon(ArrowDownData)
export const ArrowDownToLineIcon = createOutlineIcon(ArrowDownToLineData)
export const ArrowUpDownIcon = createOutlineIcon(ArrowUpDownData)
export const ArrowUpIcon = createOutlineIcon(ArrowUpData)
/** Arrows with a stem, for send and jump buttons where a chevron would read as fold. */
export const ArrowUpStemIcon = createOutlineIcon(ArrowUpStemData)
export const ArrowDownStemIcon = createOutlineIcon(ArrowDownStemData)
export const BoldIcon = createOutlineIcon(BoldData)
export const CalendarIcon = createOutlineIcon(CalendarData)
export const CheckCircleIcon = createOutlineIcon(CheckCircleData)
export const CheckIcon = createOutlineIcon(CheckData)
export const ChevronDownIcon = createOutlineIcon(ChevronDownData)
export const ChevronLeftIcon = createOutlineIcon(ChevronLeftData)
export const ChevronRightIcon = createOutlineIcon(ChevronRightData)
export const ClockIcon = createOutlineIcon(ClockData)
export const CloudUploadIcon = createOutlineIcon(CloudUploadData)
export const CopyIcon = createOutlineIcon(CopyData)
export const CornerDownRightIcon = createOutlineIcon(CornerDownRightData)
export const DragHandleIcon = createOutlineIcon(DragHandleData)
export const EyedropperIcon = createOutlineIcon(EyedropperData)
export const FileIcon = createOutlineIcon(FileData)
export const TrashIcon = createOutlineIcon(TrashData)
export const EyeIcon = createOutlineIcon(EyeData)
export const FilterIcon = createOutlineIcon(FilterData)
export const ChevronUpIcon = createOutlineIcon(ChevronUpData)
export const Heading2Icon = createOutlineIcon(Heading2Data)
export const ImageIcon = createOutlineIcon(ImageData)
export const InboxIcon = createOutlineIcon(InboxData)
export const InfoIcon = createOutlineIcon(InfoData)
export const ItalicIcon = createOutlineIcon(ItalicData)
export const LinkIcon = createOutlineIcon(LinkData)
export const ListIcon = createOutlineIcon(ListData)
export const Loader2Icon = createOutlineIcon(Loader2Data)
export const MoreHorizontalIcon = createOutlineIcon(MoreHorizontalData)
export const PencilIcon = createOutlineIcon(PencilData)
export const RefreshIcon = createOutlineIcon(RefreshData)
export const SearchIcon = createOutlineIcon(SearchData)
export const SearchRemoveIcon = createOutlineIcon(SearchRemoveData)
export const SlidersHorizontalIcon = createOutlineIcon(SlidersHorizontalData)
export const UploadIcon = createOutlineIcon(UploadData)
export const XIcon = createOutlineIcon(XData)
export const DownloadIcon = createOutlineIcon(DownloadData)
export const PrinterIcon = createOutlineIcon(PrinterData)
export const SparklesIcon = createOutlineIcon(SparklesData)
export const StarIcon = createOutlineIcon(StarData)
export const TruckIcon = createOutlineIcon(TruckData)
export const UndoIcon = createOutlineIcon(UndoData)
export const WarningIcon = createOutlineIcon(WarningData)
export const HelpCircleIcon = createOutlineIcon(HelpCircleData)
export const ImageOffIcon = createOutlineIcon(ImageOffData)
export const PauseIcon = createOutlineIcon(PauseData)
export const PlayIcon = createOutlineIcon(PlayData)
export const ZoomInIcon = createOutlineIcon(ZoomInData)
export const ZoomOutIcon = createOutlineIcon(ZoomOutData)

const ICON_PREFIX_RE = /^(?:i-)?hugeicons[-:]/
/** The finite set of names a Button or table action can ask for by string. */
const ICONS: Record<string, OutlineIconComponent> = {
  'add': AddIcon,
  'arrow-down-to-line': ArrowDownToLineIcon,
  'check': CheckIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  'clock': ClockIcon,
  'close': XIcon,
  'delete-02': TrashIcon,
  'download': DownloadIcon,
  'edit': PencilIcon,
  'eye': EyeIcon,
  'filter': FilterIcon,
  'inbox': InboxIcon,
  'more-horizontal': MoreHorizontalIcon,
  'pencil': PencilIcon,
  'plus': AddIcon,
  'printer': PrinterIcon,
  'refresh': RefreshIcon,
  'refresh-cw': RefreshIcon,
  'rotate-ccw': UndoIcon,
  'search': SearchIcon,
  'search-remove': SearchRemoveIcon,
  'sliders': SlidersHorizontalIcon,
  'sliders-horizontal': SlidersHorizontalIcon,
  'sparkles': SparklesIcon,
  'star': StarIcon,
  'truck': TruckIcon,
  'undo': UndoIcon,
  'upload': UploadIcon,
  'x': XIcon,
}

export function resolveOutlineIcon(name?: string): OutlineIconComponent | undefined {
  if (!name)
    return undefined
  const key = name.replace(ICON_PREFIX_RE, '')
  // Names arrive from JSON, so `constructor` and friends must not resolve.
  return Object.hasOwn(ICONS, key) ? ICONS[key] : undefined
}

/* -------------------------------------------------------------------------- */
/* Any HugeIcons name, loaded on first use                                     */
/* -------------------------------------------------------------------------- */

type IconModule = Record<string, unknown>
const ICON_NAME_PART_RE = /[-_\s]+/
const EXPORT_NAME_RE = /^[A-Z][A-Za-z0-9]*Icon$/
let fullSet: Promise<IconModule> | undefined
const lazyIcons = new Map<string, OutlineIconComponent | null>()

/** `delivery-truck-01` → `DeliveryTruck01Icon`; `DeliveryTruck01Icon` passes through. */
export function hugeiconsExportName(name: string): string {
  const key = name.replace(ICON_PREFIX_RE, '')
  if (EXPORT_NAME_RE.test(key))
    return key
  return `${key.split(ICON_NAME_PART_RE).filter(Boolean).map(part => part[0]!.toUpperCase() + part.slice(1)).join('')}Icon`
}

/**
 * Resolves any HugeIcons free icon by name. The common set is bundled; any
 * other name loads the full icon package once, in its own chunk, so pages and
 * Specs can use icons the library never registered without bloating the entry.
 */
export async function loadOutlineIcon(name?: string): Promise<OutlineIconComponent | undefined> {
  if (!name)
    return undefined
  const known = resolveOutlineIcon(name)
  if (known)
    return known
  const exportName = hugeiconsExportName(name)
  if (lazyIcons.has(exportName))
    return lazyIcons.get(exportName) ?? undefined
  fullSet ??= import('@hugeicons/core-free-icons') as unknown as Promise<IconModule>
  const set = await fullSet.catch(() => ({}) as IconModule)
  const data = Object.hasOwn(set, exportName) ? set[exportName] : undefined
  const icon = Array.isArray(data) ? createOutlineIcon(data as IconSvgElement) : null
  lazyIcons.set(exportName, icon)
  return icon ?? undefined
}

let loadedSet: IconModule | undefined
let iconNames: Promise<string[]> | undefined
const PASCAL_BOUNDARY_RE = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[A-Za-z])(?=\d)/

/** `DeliveryTruck01Icon` → `delivery-truck-01`, kept as the export name when the short form would not resolve back to it. */
function iconNameOf(exportName: string): string {
  const name = exportName.slice(0, -'Icon'.length).split(PASCAL_BOUNDARY_RE).join('-').toLowerCase()
  return hugeiconsExportName(name) === exportName ? name : exportName
}

/** Every HugeIcons free icon name, as `loadOutlineIcon` accepts it. Loads the full set once. */
export function loadOutlineIconNames(): Promise<string[]> {
  fullSet ??= import('@hugeicons/core-free-icons') as unknown as Promise<IconModule>
  iconNames ??= fullSet.catch(() => ({}) as IconModule).then((set) => {
    loadedSet = set
    return [...new Set(Object.keys(set).filter(key => EXPORT_NAME_RE.test(key) && Array.isArray(set[key])).map(iconNameOf))]
  })
  return iconNames
}

/** Resolves a name synchronously once `loadOutlineIconNames` has loaded the set; before that only bundled and cached names resolve. */
export function peekOutlineIcon(name?: string): OutlineIconComponent | undefined {
  if (!name)
    return undefined
  const known = resolveOutlineIcon(name)
  if (known)
    return known
  const exportName = hugeiconsExportName(name)
  if (lazyIcons.has(exportName))
    return lazyIcons.get(exportName) ?? undefined
  if (!loadedSet)
    return undefined
  const data = Object.hasOwn(loadedSet, exportName) ? loadedSet[exportName] : undefined
  const icon = Array.isArray(data) ? createOutlineIcon(data as IconSvgElement) : null
  lazyIcons.set(exportName, icon)
  return icon ?? undefined
}

/** Sync for bundled names; other names resolve after their first load. */
export function useOutlineIcon(name?: string): OutlineIconComponent | undefined {
  const known = resolveOutlineIcon(name)
  const cached = name && !known ? lazyIcons.get(hugeiconsExportName(name)) ?? undefined : undefined
  const [loaded, setLoaded] = useState<{ name: string, icon?: OutlineIconComponent }>()
  useEffect(() => {
    if (!name || known || cached)
      return
    let active = true
    void loadOutlineIcon(name).then((icon) => {
      if (active)
        setLoaded({ name, icon })
    })
    return () => {
      active = false
    }
  }, [name, known, cached])
  return known ?? cached ?? (loaded && loaded.name === name ? loaded.icon : undefined)
}

export interface LumiIconProps extends OutlineIconProps {
  /** A bundled Lumi name (`search`) or any HugeIcons name (`delivery-truck-01`). */
  name?: string
  /** Accessible name; without it the icon is decorative. */
  label?: string
  /** Rendered when the name is empty or unknown. */
  fallback?: ReactElement | null
}

/** Renders an icon by name; unknown names render `fallback` (nothing by default). */
export function LumiIcon({ name, label, fallback = null, ...props }: LumiIconProps): ReactElement | null {
  const Icon = useOutlineIcon(name)
  if (!Icon)
    return fallback
  return label
    ? <Icon {...props} role="img" aria-label={label} />
    : <Icon aria-hidden focusable="false" {...props} />
}
