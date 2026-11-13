import type { HugeiconsIconProps, IconSvgElement } from '@hugeicons/react'
import type { ForwardRefExoticComponent, RefAttributes } from 'react'
import {
  ActivityIcon as ActivityData,
  AddSquareIcon as AddSquareData,
  ArrowUp02Icon as ArrowUpData,
  AtIcon as AtData,
  BellIcon as BellData,
  BlocksIcon as BlocksData,
  BookOpenIcon as BookOpenData,
  BoxIcon as BoxData,
  BuildingIcon as BuildingData,
  CalendarIcon as CalendarData,
  ChartBarLineIcon as ChartBarData,
  ChartLineIcon as ChartLineData,
  PieChartIcon as ChartPieData,
  CheckmarkCircle02Icon as CheckCircleData,
  CheckIcon as CheckData,
  CheckListIcon as CheckListData,
  ArrowDown01Icon as ChevronDownData,
  ChevronRightIcon as ChevronRightData,
  UnfoldMoreIcon as ChevronsUpDownData,
  CircleDotIcon as CircleDotData,

  Task01Icon as ClipboardListData,
  ClockIcon as ClockData,
  CloudDownloadIcon as CloudDownloadData,
  CloudOffIcon as CloudOffData,
  CreditCardIcon as CreditCardData,
  DatabaseIcon as DatabaseData,
  Download01Icon as DownloadData,
  EllipsisIcon as EllipsisData,
  ViewIcon as EyeData,
  ViewOffSlashIcon as EyeOffData,
  File01Icon as FileData,
  FileQuestionMarkIcon as FileQuestionData,
  FilesIcon as FilesData,
  FileTextIcon as FileTextData,
  FolderIcon as FolderData,
  FolderKanbanIcon as FolderKanbanData,
  GaugeIcon as GaugeData,
  GlobeIcon as GlobeData,
  Home01Icon as HouseData,
  ImageIcon as ImageData,
  InboxIcon as InboxData,
  InfoIcon as InfoData,
  KeyRoundIcon as KeyRoundData,
  InternetIcon as LanguagesData,
  LayersIcon as LayersData,
  DashboardSquare01Icon as LayoutDashboardData,
  LayoutGridIcon as LayoutGridData,
  LayoutListIcon as LayoutListData,
  ListIcon as ListData,
  LockIcon as LockData,
  LogOutIcon as LogOutData,
  MailIcon as MailData,
  MapPinIcon as MapPinData,
  MenuIcon as MenuData,
  MessageSquareIcon as MessageSquareData,
  MonitorIcon as MonitorData,
  MoonIcon as MoonData,
  NewsIcon as NewsData,
  PackageIcon as PackageData,
  PanelLeftCloseIcon as PanelLeftCloseData,
  PanelLeftOpenIcon as PanelLeftOpenData,
  PanelRightIcon as PanelRightData,
  PanelsTopLeftIcon as PanelsTopLeftData,
  PenLineIcon as PenLineData,
  PlugIcon as PlugData,
  PlusSignIcon as PlusData,
  PrinterIcon as PrinterData,
  Invoice01Icon as ReceiptData,
  SearchIcon as SearchData,
  SettingsIcon as SettingsData,
  ShieldIcon as ShieldData,
  ShieldXIcon as ShieldXData,
  ShoppingCart02Icon as ShoppingCartData,
  SlidersHorizontalIcon as SlidersHorizontalData,
  SparklesIcon as SparklesData,
  SquarePenIcon as SquarePenData,
  SquareStackIcon as SquareStackData,
  ShoppingBag01Icon as StoreData,
  SunIcon as SunData,
  GridTableIcon as TableData,
  TagIcon as TagData,
  TextFontIcon as TextFontData,
  Tick02Icon as TickData,
  TicketIcon as TicketData,
  TrendingUpIcon as TrendingUpData,
  TriangleAlertIcon as TriangleAlertData,
  TruckIcon as TruckData,
  ArrowTurnBackwardIcon as UndoData,
  UploadIcon as UploadData,
  UserIcon as UserData,
  UsersIcon as UsersData,
  WalletIcon as WalletData,
  WorkflowIcon as WorkflowData,
  WrenchIcon as WrenchData,
  CancelCircleIcon as XCircleData,
  XIcon as XData,
  ZapIcon as ZapData,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { forwardRef } from 'react'

export type OutlineIconProps = Omit<HugeiconsIconProps, 'altIcon' | 'icon' | 'strokeWidth'>
export type OutlineIconComponent = ForwardRefExoticComponent<OutlineIconProps & RefAttributes<SVGSVGElement>>

function createOutlineIcon(icon: IconSvgElement, name: string): OutlineIconComponent {
  const Component = forwardRef<SVGSVGElement, OutlineIconProps>((props, ref) => <HugeiconsIcon {...props} ref={ref} data-lumi-icon="hugeicons" data-lumi-icon-name={name} icon={icon} strokeWidth={1.5} />)
  Component.displayName = name
  return Component
}

export const ActivityIcon = createOutlineIcon(ActivityData, 'ActivityIcon')
export const AddSquareIcon = createOutlineIcon(AddSquareData, 'AddSquareIcon')
export const BellIcon = createOutlineIcon(BellData, 'BellIcon')
export const BlocksIcon = createOutlineIcon(BlocksData, 'BlocksIcon')
export const BookOpenIcon = createOutlineIcon(BookOpenData, 'BookOpenIcon')
export const BoxIcon = createOutlineIcon(BoxData, 'BoxIcon')
export const BuildingIcon = createOutlineIcon(BuildingData, 'BuildingIcon')
export const CalendarIcon = createOutlineIcon(CalendarData, 'CalendarIcon')
export const ChartBarIcon = createOutlineIcon(ChartBarData, 'ChartBarIcon')
export const ChartLineIcon = createOutlineIcon(ChartLineData, 'ChartLineIcon')
export const ChartPieIcon = createOutlineIcon(ChartPieData, 'ChartPieIcon')
export const CheckCircleIcon = createOutlineIcon(CheckCircleData, 'CheckCircleIcon')
export const CheckIcon = createOutlineIcon(CheckData, 'CheckIcon')
export const CheckListIcon = createOutlineIcon(CheckListData, 'CheckListIcon')
export const ChevronDownIcon = createOutlineIcon(ChevronDownData, 'ChevronDownIcon')
export const ChevronRightIcon = createOutlineIcon(ChevronRightData, 'ChevronRightIcon')
export const ChevronsUpDownIcon = createOutlineIcon(ChevronsUpDownData, 'ChevronsUpDownIcon')
export const CircleDotIcon = createOutlineIcon(CircleDotData, 'CircleDotIcon')
export const ClipboardListIcon = createOutlineIcon(ClipboardListData, 'ClipboardListIcon')
export const ClockIcon = createOutlineIcon(ClockData, 'ClockIcon')
export const CloudDownloadIcon = createOutlineIcon(CloudDownloadData, 'CloudDownloadIcon')
export const CloudOffIcon = createOutlineIcon(CloudOffData, 'CloudOffIcon')
export const CreditCardIcon = createOutlineIcon(CreditCardData, 'CreditCardIcon')
export const DatabaseIcon = createOutlineIcon(DatabaseData, 'DatabaseIcon')
export const EllipsisIcon = createOutlineIcon(EllipsisData, 'EllipsisIcon')
export const FileQuestionIcon = createOutlineIcon(FileQuestionData, 'FileQuestionIcon')
export const FileTextIcon = createOutlineIcon(FileTextData, 'FileTextIcon')
export const FilesIcon = createOutlineIcon(FilesData, 'FilesIcon')
export const FolderIcon = createOutlineIcon(FolderData, 'FolderIcon')
export const FolderKanbanIcon = createOutlineIcon(FolderKanbanData, 'FolderKanbanIcon')
export const GaugeIcon = createOutlineIcon(GaugeData, 'GaugeIcon')
export const GlobeIcon = createOutlineIcon(GlobeData, 'GlobeIcon')
export const HouseIcon = createOutlineIcon(HouseData, 'HouseIcon')
export const ImageIcon = createOutlineIcon(ImageData, 'ImageIcon')
export const InfoIcon = createOutlineIcon(InfoData, 'InfoIcon')
export const InboxIcon = createOutlineIcon(InboxData, 'InboxIcon')
export const KeyRoundIcon = createOutlineIcon(KeyRoundData, 'KeyRoundIcon')
export const LanguagesIcon = createOutlineIcon(LanguagesData, 'LanguagesIcon')
export const LayersIcon = createOutlineIcon(LayersData, 'LayersIcon')
export const LayoutDashboardIcon = createOutlineIcon(LayoutDashboardData, 'LayoutDashboardIcon')
export const LayoutGridIcon = createOutlineIcon(LayoutGridData, 'LayoutGridIcon')
export const LayoutListIcon = createOutlineIcon(LayoutListData, 'LayoutListIcon')
export const ListIcon = createOutlineIcon(ListData, 'ListIcon')
export const LockIcon = createOutlineIcon(LockData, 'LockIcon')
export const LogOutIcon = createOutlineIcon(LogOutData, 'LogOutIcon')
export const MailIcon = createOutlineIcon(MailData, 'MailIcon')
export const MapPinIcon = createOutlineIcon(MapPinData, 'MapPinIcon')
export const MenuIcon = createOutlineIcon(MenuData, 'MenuIcon')
export const MessageSquareIcon = createOutlineIcon(MessageSquareData, 'MessageSquareIcon')
export const MonitorIcon = createOutlineIcon(MonitorData, 'MonitorIcon')
export const MoonIcon = createOutlineIcon(MoonData, 'MoonIcon')
export const NewsIcon = createOutlineIcon(NewsData, 'NewsIcon')
export const PackageIcon = createOutlineIcon(PackageData, 'PackageIcon')
export const PanelLeftCloseIcon = createOutlineIcon(PanelLeftCloseData, 'PanelLeftCloseIcon')
export const PanelLeftOpenIcon = createOutlineIcon(PanelLeftOpenData, 'PanelLeftOpenIcon')
export const PanelRightIcon = createOutlineIcon(PanelRightData, 'PanelRightIcon')
export const PanelsTopLeftIcon = createOutlineIcon(PanelsTopLeftData, 'PanelsTopLeftIcon')
export const PenLineIcon = createOutlineIcon(PenLineData, 'PenLineIcon')
export const PlugIcon = createOutlineIcon(PlugData, 'PlugIcon')
export const SearchIcon = createOutlineIcon(SearchData, 'SearchIcon')
export const SettingsIcon = createOutlineIcon(SettingsData, 'SettingsIcon')
export const ShieldIcon = createOutlineIcon(ShieldData, 'ShieldIcon')
export const ShieldXIcon = createOutlineIcon(ShieldXData, 'ShieldXIcon')
export const ShoppingCartIcon = createOutlineIcon(ShoppingCartData, 'ShoppingCartIcon')
export const SlidersHorizontalIcon = createOutlineIcon(SlidersHorizontalData, 'SlidersHorizontalIcon')
export const SquarePenIcon = createOutlineIcon(SquarePenData, 'SquarePenIcon')
export const SquareStackIcon = createOutlineIcon(SquareStackData, 'SquareStackIcon')
export const StoreIcon = createOutlineIcon(StoreData, 'StoreIcon')
export const SunIcon = createOutlineIcon(SunData, 'SunIcon')
export const TagIcon = createOutlineIcon(TagData, 'TagIcon')
export const TableIcon = createOutlineIcon(TableData, 'TableIcon')
export const TextFontIcon = createOutlineIcon(TextFontData, 'TextFontIcon')
export const TicketIcon = createOutlineIcon(TicketData, 'TicketIcon')
export const TrendingUpIcon = createOutlineIcon(TrendingUpData, 'TrendingUpIcon')
export const TriangleAlertIcon = createOutlineIcon(TriangleAlertData, 'TriangleAlertIcon')
export const TruckIcon = createOutlineIcon(TruckData, 'TruckIcon')
export const UploadIcon = createOutlineIcon(UploadData, 'UploadIcon')
export const UserIcon = createOutlineIcon(UserData, 'UserIcon')
export const UsersIcon = createOutlineIcon(UsersData, 'UsersIcon')
export const WalletIcon = createOutlineIcon(WalletData, 'WalletIcon')
export const WorkflowIcon = createOutlineIcon(WorkflowData, 'WorkflowIcon')
export const WrenchIcon = createOutlineIcon(WrenchData, 'WrenchIcon')
export const XIcon = createOutlineIcon(XData, 'XIcon')
export const XCircleIcon = createOutlineIcon(XCircleData, 'XCircleIcon')
export const ZapIcon = createOutlineIcon(ZapData, 'ZapIcon')
export const ReceiptIcon = createOutlineIcon(ReceiptData, 'ReceiptIcon')
export const UndoIcon = createOutlineIcon(UndoData, 'UndoIcon')
export const DownloadIcon = createOutlineIcon(DownloadData, 'DownloadIcon')
export const SparklesIcon = createOutlineIcon(SparklesData, 'SparklesIcon')
export const PrinterIcon = createOutlineIcon(PrinterData, 'PrinterIcon')
export const PlusIcon = createOutlineIcon(PlusData, 'PlusIcon')
export const AtIcon = createOutlineIcon(AtData, 'AtIcon')
export const ArrowUpIcon = createOutlineIcon(ArrowUpData, 'ArrowUpIcon')
export const EyeIcon = createOutlineIcon(EyeData, 'EyeIcon')
export const EyeOffIcon = createOutlineIcon(EyeOffData, 'EyeOffIcon')
export const FileIcon = createOutlineIcon(FileData, 'FileIcon')
export const TickIcon = createOutlineIcon(TickData, 'TickIcon')
