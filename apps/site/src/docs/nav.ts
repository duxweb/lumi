import { actionLinks, bindingLinks, packageApiGroups, providerLinks } from './generated/navigation.mjs'
import { docsCatalog } from './reference/catalog'
import { FAMILIES, familyOf, OTHER_FAMILY } from './reference/families'

export interface NavLink { label: string, slug: string }
export interface NavGroup { label: string, items: NavLink[] }
export interface DocsSection { id: string, label: string, home: string, match: string[], groups: NavGroup[] }

const LOWER_UPPER_RE = /([a-z\d])([A-Z])/g
const UPPER_WORD_RE = /([A-Z]+)([A-Z][a-z])/g
const slugify = (value: string): string => value.replace(LOWER_UPPER_RE, '$1-$2').replace(UPPER_WORD_RE, '$1-$2').toLowerCase()

const componentGroups: NavGroup[] = [...FAMILIES.map(([family]) => family), OTHER_FAMILY]
  .map(family => ({
    label: family,
    items: docsCatalog.components
      .filter(component => familyOf(component.type) === family)
      .map(component => ({ label: component.type, slug: `components/${component.category}/${slugify(component.type)}` })),
  }))
  .filter(group => group.items.length > 0)

export const SECTIONS: DocsSection[] = [
  { id: 'guide', label: '指南', home: 'guide', match: ['guide'], groups: [
    { label: '开始', items: [
      { label: '学习路线', slug: 'guide' },
      { label: '介绍', slug: 'guide/what-is-lumi' },
      { label: '快速开始', slug: 'guide/getting-started' },
      { label: '项目配置', slug: 'guide/config' },
    ] },
    { label: '对接后端', items: [
      { label: '数据接口', slug: 'guide/backend' },
      { label: '登录和权限', slug: 'guide/backend-auth' },
      { label: '上传和导入导出', slug: 'guide/backend-files' },
    ] },
    { label: '写页面', items: [
      { label: '页面 JSON', slug: 'guide/pages' },
      { label: '读取数据', slug: 'guide/data' },
      { label: '列表与筛选', slug: 'guide/lists' },
      { label: '表单与保存', slug: 'guide/forms' },
      { label: '详情页', slug: 'guide/detail' },
      { label: '仪表盘', slug: 'guide/dashboards' },
      { label: '交互', slug: 'guide/interactions' },
      { label: 'CRUD 页面', slug: 'guide/crud' },
    ] },
    { label: '搭后台', items: [
      { label: '菜单与路由', slug: 'guide/menus' },
      { label: '从后端加载', slug: 'guide/remote' },
      { label: '弹窗与复用', slug: 'guide/reuse' },
      { label: '嵌入网页', slug: 'guide/embed' },
      { label: 'AI 助手', slug: 'guide/assistant' },
      { label: '主题', slug: 'guide/theme' },
      { label: '多语言', slug: 'guide/i18n' },
    ] },
    { label: '用代码扩展', items: [
      { label: '扩展模块', slug: 'guide/modules' },
      { label: '组件和动作', slug: 'guide/extend-components' },
      { label: '后端和登录', slug: 'guide/extend-backend' },
      { label: 'JS 页面', slug: 'guide/js-pages' },
    ] },
    { label: '上线', items: [
      { label: '部署', slug: 'guide/deployment' },
      { label: '常见问题', slug: 'guide/faq' },
    ] },
    { label: '进阶', items: [
      { label: '架构总览', slug: 'guide/advanced/architecture' },
      { label: 'npm 安装', slug: 'guide/advanced/install' },
      { label: 'React 集成', slug: 'guide/advanced/react' },
      { label: 'Admin 应用', slug: 'guide/advanced/admin' },
      { label: '数据请求', slug: 'guide/advanced/data' },
      { label: '认证', slug: 'guide/advanced/auth' },
      { label: '权限', slug: 'guide/advanced/access' },
      { label: '其他 Provider', slug: 'guide/advanced/providers' },
      { label: '数据 hooks', slug: 'guide/advanced/hooks' },
      { label: '自定义组件', slug: 'guide/advanced/components' },
    ] },
  ] },
  { id: 'components', label: '组件', home: 'components', match: ['components'], groups: [
    { label: '概览', items: [
      { label: '组件总览', slug: 'components' },
      { label: 'Agent 消息', slug: 'components/integration/agent-messages' },
    ] },
    ...componentGroups,
  ] },
  { id: 'api', label: 'API', home: 'api', match: ['api', 'core', 'protocol'], groups: [
    { label: '概览', items: [{ label: '公开 API', slug: 'api' }] },
    { label: '动作', items: [{ label: '动作总览', slug: 'protocol/actions' }, ...actionLinks] },
    { label: '数据服务', items: providerLinks },
    { label: 'React hooks', items: bindingLinks },
    ...packageApiGroups,
  ] },
  { id: 'ai', label: 'Skills', home: 'ai', match: ['ai'], groups: [
    { label: 'AI 开发', items: [
      { label: '用 AI 写页面', slug: 'ai' },
      { label: 'Lumi Skill', slug: 'ai/skill' },
      { label: 'lumi-check', slug: 'ai/checker' },
    ] },
  ] },
]

export function sectionOf(slug: string): DocsSection | undefined {
  const head = slug.split('/')[0]!
  return SECTIONS.find(section => section.match.includes(head))
}

/** The sidebar order flattened, for previous / next links. */
export function neighbours(section: DocsSection, slug: string): { prev?: NavLink, next?: NavLink } {
  const links = section.groups.flatMap(group => group.items)
  const index = links.findIndex(link => link.slug === slug)
  return index < 0 ? {} : { prev: links[index - 1], next: links[index + 1] }
}
