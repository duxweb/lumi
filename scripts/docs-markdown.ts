// Markdown for the generated reference pages. Every page is plain Markdown so
// that readers without the site (Context7, llms-full.txt, an editor) see the
// whole reference; the site only adds a live preview through one MDX tag.

const SPLIT_CODE_RE = /(`[^`]*`)/u
const PIPE_RE = /\|/gu
const NEWLINE_RE = /\s*\n\s*/gu
const SENTENCE_END_RE = /[。！？]|\.\s/u
const MAX_TYPE_TEXT_LENGTH = 320

/** Text outside code spans, made safe for MDX: braces and angle brackets are literal. */
export function prose(text: string): string {
  return text
    .split(SPLIT_CODE_RE)
    .map(part => part.startsWith('`') ? part : part.replaceAll('{', '\\{').replaceAll('}', '\\}').replaceAll('<', '&lt;').replaceAll('>', '&gt;'))
    .join('')
}

/** A value inside a table cell: one line, pipes escaped (GFM honours `\|` inside code spans too). */
function cell(text: string): string {
  return text.replace(NEWLINE_RE, ' ').replace(PIPE_RE, '\\|')
}

/** Inline code that survives any content, including backticks. */
export function code(text: string): string {
  const value = text.length > MAX_TYPE_TEXT_LENGTH ? `${text.slice(0, MAX_TYPE_TEXT_LENGTH - 3)}...` : text
  return value.includes('`') ? `\`\` ${value} \`\`` : `\`${value}\``
}

export function table(head: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n')
}

export function fence(language: string, body: string): string {
  return `\`\`\`${language}\n${body.trimEnd()}\n\`\`\``
}

export function frontmatter(title: string, description: string): string {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---`
}

/** The first sentence of a lead, code spans kept, for summaries inside a page. */
export function leadSentence(text: string): string {
  const end = text.search(SENTENCE_END_RE)
  return end < 0 ? text : text.slice(0, end + 1)
}

/** The first sentence as plain text, for the page description. */
export function firstSentence(text: string): string {
  return leadSentence(text).replaceAll('`', '')
}

export function page(parts: readonly (string | false | undefined)[]): string {
  return `${parts.filter(Boolean).join('\n\n')}\n`
}

// What a member means when the TypeScript source has no doc comment.
const API_FIELD_NOTES: Record<string, string> = {
  resource: '交给 DataProvider 解释的数据目标，如 `orders`。',
  dataProvider: '一个 DataProvider，或以名称索引的多个 DataProvider。',
  dataProviderName: '多数据源名称；省略时使用 default。',
  pagination: '分页参数；传 false 关闭分页。',
  filters: '筛选条件数组。',
  sorters: '排序条件数组。',
  enabled: '是否允许自动执行查询。',
  meta: '原样传给 DataProvider 的扩展数据。',
  id: '记录主键。',
  ids: '记录主键数组。',
  variables: '提交给 DataProvider 的业务字段。',
  initialValues: '表单初始值。',
  pageSize: '每页条数。',
  context: '`createLumi` 创建的共享上下文。',
  config: '创建 Lumi 上下文时使用的 Provider 与运行环境配置。',
  validator: '统一的数据校验器，可接 AJV、Zod、Valibot 或自定义实现。',
  upload: '全局上传地址、请求头和允许的目标来源。',
  theme: '主题 JSON 或远程主题地址。',
  manifest: '本地 Manifest 对象或远程 URL。',
  authProvider: '登录、退出、会话检查和读取身份。',
  accessProvider: '权限判断。',
  i18nProvider: '翻译、切换语言和格式化。',
  routerProvider: '与框架无关的导航。',
  queryClient: '复用已有的 TanStack Query Client。',
  url: '请求地址。',
  method: 'HTTP 方法。',
  query: '查询参数。',
  headers: '请求头。',
  signal: '用于取消请求的 AbortSignal。',
  timeout: '超时毫秒数。',
  apiUrl: 'REST API 基础地址。',
  http: '发送请求的 HttpClient，带上认证提供者给的凭证、语言和工作区。',
  authorizeRequest: '每次请求前调用，返回这次请求要带的请求头和 fetch credentials。',
  refresh: '请求返回 401 后续期凭证；返回 true 时原请求会重发一次。',
  onSuccess: '请求成功后的回调。',
  onError: '请求失败后的回调。',
}

export function explain(name: string, description: string): string {
  return description || API_FIELD_NOTES[name] || ''
}

export interface ApiMemberDoc { name: string, type: string, required: boolean, description: string }
export interface ApiItemDoc {
  name: string
  importPath: string
  kind: string
  description: string
  type: string
  signatures: string[]
  parameters: (ApiMemberDoc & { fields: ApiMemberDoc[] })[]
  returns: string[]
  returnFields: ApiMemberDoc[]
  members: ApiMemberDoc[]
}

function memberRows(members: readonly ApiMemberDoc[]): string[][] {
  return members.map(member => [
    code(member.name),
    code(member.type),
    member.required ? '是' : '否',
    prose(explain(member.name, member.description)),
  ])
}
const MEMBER_HEAD = ['名称', '类型', '必填', '说明']

/** One exported symbol: its signature, parameters, return value and members. */
export function apiItem(item: ApiItemDoc, heading: string, packageName: string): string {
  const declaration = item.signatures.length
    ? item.signatures.join('\n')
    : item.kind === 'interface' || item.kind === 'class'
      ? `${item.kind} ${item.name}`
      : item.kind === 'type'
        ? `type ${item.name} = ${item.type}`
        : `const ${item.name}: ${item.type}`
  return page([
    `${heading} ${item.name}`,
    item.importPath !== packageName && `导入路径：${code(item.importPath)}`,
    item.description && prose(item.description),
    // Declarations, not runnable code: the docs' TypeScript example check skips this fence.
    fence('typescript', declaration),
    item.parameters.length > 0 && table(['参数', '类型', '必填', '说明'], memberRows(item.parameters)),
    ...item.parameters.filter(parameter => parameter.fields.length > 0).map(parameter => `${code(parameter.name)} 的字段：\n\n${table(MEMBER_HEAD, memberRows(parameter.fields))}`),
    item.returns.length > 0 && `返回 ${code(item.returns.join(' | '))}。`,
    item.returnFields.length > 0 && `返回结构：\n\n${table(MEMBER_HEAD, memberRows(item.returnFields))}`,
    item.members.length > 0 && table(MEMBER_HEAD, memberRows(item.members)),
  ]).trimEnd()
}
