import type { ReactElement, ReactNode } from 'react'
import type { OutlineIconComponent } from '../icons.js'
import { LumiIcon } from '@duxweb/lumi-ui'
import {
  ActivityIcon,
  AddSquareIcon,
  ArrowUpIcon,
  AtIcon,
  BellIcon,
  BlocksIcon,
  BookOpenIcon,
  BoxIcon,
  BuildingIcon,
  CalendarIcon,
  ChartBarIcon,
  ChartLineIcon,
  ChartPieIcon,
  CheckCircleIcon,
  CheckIcon,
  CheckListIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  CircleDotIcon,
  ClipboardListIcon,
  ClockIcon,
  CloudDownloadIcon,
  CreditCardIcon,
  DatabaseIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  FileIcon,
  FileQuestionIcon,
  FilesIcon,
  FileTextIcon,
  FolderIcon,
  FolderKanbanIcon,
  GaugeIcon,
  GlobeIcon,
  HouseIcon,
  ImageIcon,
  InboxIcon,
  InfoIcon,
  KeyRoundIcon,
  LanguagesIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  LayoutListIcon,
  ListIcon,
  LockIcon,
  LogOutIcon,
  MailIcon,
  MapPinIcon,
  MenuIcon,
  MessageSquareIcon,
  MonitorIcon,
  MoonIcon,
  NewsIcon,
  PackageIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PanelRightIcon,
  PanelsTopLeftIcon,
  PenLineIcon,
  PlugIcon,
  PlusIcon,
  PrinterIcon,
  ReceiptIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SquarePenIcon,
  SquareStackIcon,
  StoreIcon,
  SunIcon,
  TableIcon,
  TagIcon,
  TextFontIcon,
  TicketIcon,
  TickIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  TruckIcon,
  UndoIcon,
  UploadIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  WorkflowIcon,
  WrenchIcon,
  XCircleIcon,
  XIcon,
  ZapIcon,
} from '../icons.js'

/** Shell chrome icons; referenced by the built-in layouts only. */
const CHROME = {
  'bell': BellIcon,
  'check': CheckIcon,
  'chevron-down': ChevronDownIcon,
  'chevron-right': ChevronRightIcon,
  'chevrons-up-down': ChevronsUpDownIcon,
  'circle-dot': CircleDotIcon,
  'ellipsis': EllipsisIcon,
  'eye': EyeIcon,
  'eye-off': EyeOffIcon,
  'folder': FolderIcon,
  'home': HouseIcon,
  'languages': LanguagesIcon,
  'layout-grid': LayoutGridIcon,
  'log-out': LogOutIcon,
  'menu': MenuIcon,
  'monitor': MonitorIcon,
  'moon': MoonIcon,
  'panel-left-close': PanelLeftCloseIcon,
  'panel-left-open': PanelLeftOpenIcon,
  'panel-right': PanelRightIcon,
  'search': SearchIcon,
  'sun': SunIcon,
  'x': XIcon,
} as const satisfies Record<string, OutlineIconComponent>

/**
 * Menu and module icons come from the Manifest as neutral names. The set is
 * static so the published bundle stays tree-shaken; `registerShellIcons`
 * extends it for names outside this catalog.
 */
const MENU: Record<string, OutlineIconComponent> = {
  ...CHROME,
  'receipt': ReceiptIcon,
  'plus': PlusIcon,
  'at': AtIcon,
  'arrow-up': ArrowUpIcon,
  'eye': EyeIcon,
  'file': FileIcon,
  'tick': TickIcon,
  'clock': ClockIcon,
  'undo': UndoIcon,
  'download': DownloadIcon,
  'sparkles': SparklesIcon,
  'printer': PrinterIcon,
  'activity': ActivityIcon,
  'blocks': BlocksIcon,
  'book-open': BookOpenIcon,
  'box': BoxIcon,
  'building': BuildingIcon,
  'calendar': CalendarIcon,
  'chart-bar': ChartBarIcon,
  'chart-line': ChartLineIcon,
  'chart-pie': ChartPieIcon,
  'circle-check': CheckCircleIcon,
  'circle-x': XCircleIcon,
  'clipboard-list': ClipboardListIcon,
  'cloud-download': CloudDownloadIcon,
  'credit-card': CreditCardIcon,
  'database': DatabaseIcon,
  'file-question': FileQuestionIcon,
  'file-text': FileTextIcon,
  'files': FilesIcon,
  'folder-kanban': FolderKanbanIcon,
  'gauge': GaugeIcon,
  'globe': GlobeIcon,
  'image': ImageIcon,
  'info': InfoIcon,
  'inbox': InboxIcon,
  'key-round': KeyRoundIcon,
  'layers': LayersIcon,
  'layout-dashboard': LayoutDashboardIcon,
  'layout-list': LayoutListIcon,
  'list': ListIcon,
  'list-checks': CheckListIcon,
  'lock': LockIcon,
  'mail': MailIcon,
  'map-pin': MapPinIcon,
  'message-square': MessageSquareIcon,
  'news': NewsIcon,
  'package': PackageIcon,
  'panels-top-left': PanelsTopLeftIcon,
  'pen-line': PenLineIcon,
  'plug': PlugIcon,
  'settings': SettingsIcon,
  'shield': ShieldIcon,
  'shopping-cart': ShoppingCartIcon,
  'sliders-horizontal': SlidersHorizontalIcon,
  'square-pen': SquarePenIcon,
  'square-plus': AddSquareIcon,
  'square-stack': SquareStackIcon,
  'store': StoreIcon,
  'tag': TagIcon,
  'table': TableIcon,
  'ticket': TicketIcon,
  'trending-up': TrendingUpIcon,
  'truck': TruckIcon,
  'triangle-alert': TriangleAlertIcon,
  'type': TextFontIcon,
  'upload': UploadIcon,
  'user': UserIcon,
  'users': UsersIcon,
  'wallet': WalletIcon,
  'wrench': WrenchIcon,
  'workflow': WorkflowIcon,
  'zap': ZapIcon,
}

export type ShellChromeIcon = keyof typeof CHROME

/** Registers extra Manifest icon names with the same SVG component contract. */
export function registerShellIcons(icons: Record<string, OutlineIconComponent>): void {
  Object.assign(MENU, icons)
}

const ICON_PREFIX_RE = /^(?:i-)?hugeicons[-:]/

/** Accepts bare names and the `i-hugeicons-*` / `hugeicons:*` shorthands. */
function normalize(name: string): string {
  return name.replace(ICON_PREFIX_RE, '')
}

export function ShellChrome({ name, className }: { name: ShellChromeIcon, className?: string }): ReactElement {
  const Icon = CHROME[name]
  return <Icon className={className} aria-hidden focusable="false" />
}

export interface ShellIconProps {
  name?: string
  className?: string
  fallback?: ReactNode
}

export function ShellIcon({ name, className, fallback }: ShellIconProps): ReactNode {
  const Icon = name ? MENU[normalize(name)] : undefined
  const placeholder = fallback ?? <CircleDotIcon className={className} aria-hidden focusable="false" />
  // Names outside the Shell set resolve against the full HugeIcons package.
  if (!Icon)
    return name ? <LumiIcon name={name} className={className} fallback={placeholder as ReactElement} /> : placeholder
  return <Icon className={className} aria-hidden focusable="false" />
}
