// Components grouped by what they are for, not by package. The docs sidebar and
// the generated component overview share this order; anything unlisted falls
// under OTHER_FAMILY.
export const FAMILIES: readonly (readonly [string, readonly string[]])[] = [
  ['通用', ['Button', 'Icon', 'Text', 'Heading', 'Badge', 'Avatar', 'AvatarGroup', 'CodeBlock']],
  ['布局', ['Stack', 'Grid', 'Frame', 'Card', 'Separator', 'Fragment', 'Page', 'PageFrame', 'PageHeader']],
  ['数据录入', ['Form', 'FormField', 'Input', 'Textarea', 'RichText', 'NumberInput', 'Select', 'MultiSelect', 'Cascader', 'Checkbox', 'CheckboxGroup', 'RadioGroup', 'Switch', 'Segmented', 'TagsInput', 'DatePicker', 'TimePicker', 'DateTimePicker', 'DateRangePicker', 'Upload', 'ImageGrid', 'CodeEditor']],
  ['数据展示', ['Table', 'DataGrid', 'RecordList', 'DescriptionList', 'Timeline', 'ActivityFeed', 'Tabs', 'Progress', 'Stepper', 'Pagination', 'Filters', 'FilterBar']],
  ['图表与指标', ['Chart', 'BarChart', 'MatrixChart', 'MetricCard', 'StatStrip', 'Pipeline', 'FunnelChart', 'ProportionList', 'DashboardCard']],
  ['反馈与浮层', ['Alert', 'Dialog', 'Drawer', 'EmptyState']],
  ['页面模板', ['DashboardPage', 'ListPage', 'DetailPage', 'FormPage', 'SettingsPage', 'SettingsForm']],
  ['数据连接', ['Query', 'CanAccess']],
]

export const OTHER_FAMILY = '其他'

export function familyOf(type: string): string {
  return FAMILIES.find(([, members]) => members.includes(type))?.[0] ?? OTHER_FAMILY
}
