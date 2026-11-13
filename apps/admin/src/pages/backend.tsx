import type { DataProvider } from '@duxweb/lumi'
import type { TableColumn } from '@duxweb/lumi-ui'
import type { Spec } from '@json-render/core'
import type { ReactElement } from 'react'
import type { CodeFile } from '../developer/kit.js'
import { createSpecLoader, LumiSpecPage, useCan, useList, useLumi, useTranslate } from '@duxweb/lumi'
import { LumiCodeExample } from '@duxweb/lumi-admin'
import { LumiAlert as Alert, LumiBadge as Badge, LumiButton as Button, LumiDescriptionList as DescriptionList, LumiInput as Input, LumiPagination as Pagination, LumiStack as Stack, LumiTable as Table } from '@duxweb/lumi-ui'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { CAPABILITIES } from '../capabilities.js'
import { Code, DeveloperPage, SpecExample } from '../developer/kit.js'
import { json } from '../developer/source.js'
import { ExchangeView, useRecorder } from '../developer/wire.js'
import { brokenSpec, errorSpecs } from '../json-specs.js'
import { apiUrl, mountedPanel } from '../session.js'
import { perLocale } from '../shared.js'
import { showcaseCatalog, showcaseRegistry } from './json.js'

// The backend contract. Every live call goes to the mock API through the same
// createSimpleDataProvider the app uses, and the result pane shows the real exchange.
// The Go handlers share two helpers: writeJSON(w, status, body) and
// writeError(w, status, message).

/** Runs a read once on mount, so a GET example opens with its response. */
function useOnMount(run: () => void): void {
  useEffect(run, [])
}

/* -------------------------------------------------------------------------- */
/* Served pages                                                               */

const PAGE_HANDLER: CodeFile = {
  name: 'pages.go',
  language: 'go',
  code: `// GET /pages/{name}: the page Spec as stored. CI runs lumi-check over
// the files; the client validates again before it renders anything.
func pageHandler(w http.ResponseWriter, r *http.Request) {
\tpage, ok := pages[r.PathValue("name")]
\tif !ok {
\t\twriteError(w, http.StatusNotFound, "page not found")
\t\treturn
\t}
\tif r.Header.Get("If-None-Match") == page.ETag {
\t\tw.WriteHeader(http.StatusNotModified)
\t\treturn
\t}
\tw.Header().Set("ETag", page.ETag)
\twriteJSON(w, http.StatusOK, page.Spec)
}`,
}

const PAGE_CLIENT: CodeFile = {
  name: 'OrderQueue.tsx',
  language: 'tsx',
  code: `import { createSpecLoader, LumiSpecPage, useLumi } from '@duxweb/lumi'
import { adminRegistry } from '@duxweb/lumi-admin'
import { catalog } from './catalog'

// Auth headers go only to trusted origins; responses are cached per URL
// and revalidated with ETag.
const loader = createSpecLoader(catalog, {
  headers: () => ({ Authorization: session.token() }),
  trustedOrigins: ['https://api.example.com'],
})

export function OrderQueue() {
  return (
    <LumiSpecPage
      catalog={catalog}
      loader={loader}
      src="https://api.example.com/pages/order-queue"
      context={useLumi()}
      registry={adminRegistry}
    />
  )
}`,
}

const ROUTE_SOURCE: CodeFile = {
  name: 'manifest.json',
  language: 'json',
  code: json({
    routes: [{
      name: 'order-queue',
      path: '/orders/queue',
      page: { src: 'https://api.example.com/pages/order-queue' },
      menu: { label: 'Order queue', icon: 'list' },
    }],
  }),
}

function ServedPageExample(): ReactElement {
  const t = useTranslate()
  const context = useLumi()
  const queryClient = useQueryClient()
  const { exchange, run } = useRecorder()
  const [reload, setReload] = useState(0)
  const loader = useMemo(() => createSpecLoader(showcaseCatalog, {
    // Served pages go through the app's client, so they carry the reader's credentials.
    fetcher: ((input: RequestInfo | URL, init?: RequestInit) => context.http.fetch(String(input instanceof Request ? input.url : input), init)) as typeof fetch,
    trustedOrigins: [new URL(apiUrl()).origin],
  }), [context])
  useOnMount(() => run(provider => provider.custom!({ url: '/pages/order-queue' })))
  return (
    <LumiCodeExample
      title={t('The backend returns the Spec')}
      layout="stack"
      code={<Code files={[PAGE_HANDLER, PAGE_CLIENT, { name: 'GET /pages/order-queue', language: 'json', code: exchange ? json(exchange.response) : '' }]} />}
      previewLabel={t('Result')}
      previewActions={<Button label={t('Reload page Spec')} appearance="ghost" size="sm" icon="refresh" onClick={() => setReload(value => value + 1)} />}
      preview={<LumiSpecPage catalog={showcaseCatalog} loader={loader} src={`${apiUrl()}/pages/order-queue`} reloadKey={reload} context={context} queryClient={queryClient} registry={showcaseRegistry} />}
    />
  )
}

function RejectedPageExample(): ReactElement {
  const t = useTranslate()
  const context = useLumi()
  const queryClient = useQueryClient()
  return (
    <LumiCodeExample
      title={t('An invalid Spec never renders')}
      code={(
        <Code files={[
          { name: 'pages/promo.json', language: 'json', code: json(brokenSpec) },
          { name: 'ci.sh', language: 'bash', code: 'for page in pages/*.json; do\n  npx lumi-check "$page" || exit 1\ndone' },
        ]}
        />
      )}
      previewLabel={t('Result')}
      preview={<LumiSpecPage catalog={showcaseCatalog} spec={brokenSpec as Spec} context={context} queryClient={queryClient} registry={showcaseRegistry} />}
    />
  )
}

const ROUTES_PER_PAGE = 8

const servedColumns = perLocale((t): TableColumn[] => ([
  { field: 'path', label: t('Path'), kind: 'code' },
  { field: 'src', label: 'page.src', kind: 'code' },
]))

function ManifestExample(): ReactElement {
  const t = useTranslate()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const rows = useMemo(() => CAPABILITIES.filter(item => item.spec).map(item => ({ id: item.name, path: item.path, src: `/pages/${item.spec}` })), [])
  return (
    <LumiCodeExample
      title={t('Routes that point at a Spec')}
      code={<Code files={[ROUTE_SOURCE]} />}
      previewLabel={t('Result')}
      preview={(
        <>
          <Table rowKey="id" columns={servedColumns(t)} rows={rows.slice((page - 1) * ROUTES_PER_PAGE, page * ROUTES_PER_PAGE)} onRowClick={row => navigate(String(row.path))} />
          <Pagination ariaLabel={t('Routes pages')} page={page} pageSize={ROUTES_PER_PAGE} total={rows.length} onPageChange={setPage} />
        </>
      )}
    />
  )
}

export function AdminBackendSpecRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Served pages')} description={t('The backend serves a page Spec; the front end validates and renders it')}>
      <ServedPageExample />
      <RejectedPageExample />
      <ManifestExample />
    </DeveloperPage>
  )
}

/* -------------------------------------------------------------------------- */
/* Data API                                                                   */

const CONTRACT = `GET    /{resource}?page=1&pageSize=20&status=paid&total[gte]=100&sort=-total
       200 { "data": [ … ], "meta": { "total": 128 } }
GET    /{resource}/{id}                200 { "data": { … } }
GET    /{resource}?ids[]=1&ids[]=2     200 { "data": [ … ] }
POST   /{resource}        body: record     201 { "data": { … } }
PUT    /{resource}/{id}   body: changes    200 { "data": { … } }
DELETE /{resource}/{id}                200 { "data": { … } }
ANY    /{url}             custom endpoints; a GET takes a query, never a body

Request headers   Authorization: <token>   Accept-Language: <locale>
Filters           field=value (eq), field[op]=value: ne lt lte gt gte like nlike in nin between null nnull
Failures          non-2xx { "message", "code"?, "errors"?: [{ "path", "message", "code"? }] }`

const LIST_FILES: readonly CodeFile[] = [
  {
    name: 'page.json',
    language: 'json',
    code: json({
      type: 'Query',
      props: {
        resource: 'orders',
        pagination: { page: 1, pageSize: 3 },
        filters: [{ field: 'status', operator: 'eq', value: 'paid' }, { field: 'total', operator: 'gte', value: 100 }],
        sorters: [{ field: 'total', order: 'desc' }],
        resultPath: '/orders',
      },
      children: [],
    }),
  },
  {
    name: 'hooks.ts',
    language: 'ts',
    code: `const { data, total } = await dataProvider.getList({
  resource: 'orders',
  pagination: { page: 1, pageSize: 3 },
  filters: [
    { field: 'status', operator: 'eq', value: 'paid' },
    { field: 'total', operator: 'gte', value: 100 },
  ],
  sorters: [{ field: 'total', order: 'desc' }],
})`,
  },
  {
    name: 'orders.go',
    language: 'go',
    code: `// GET /orders?status=paid&total[gte]=100
//   &sort=-total&page=1&pageSize=3
func listOrders(w http.ResponseWriter, r *http.Request) {
\tq := r.URL.Query()
\tquery := db.Model(&Order{})
\tif status := q.Get("status"); status != "" {
\t\tquery = query.Where("status = ?", status)
\t}
\tif min := q.Get("total[gte]"); min != "" {
\t\tquery = query.Where("total >= ?", min)
\t}
\tfor _, sort := range strings.Split(q.Get("sort"), ",") {
\t\tfield, desc := strings.CutPrefix(sort, "-")
\t\tdir := "asc"
\t\tif desc {
\t\t\tdir = "desc"
\t\t}
\t\tif column, ok := sortable[field]; ok {
\t\t\tquery = query.Order(column + " " + dir)
\t\t}
\t}
\tvar total int64
\tquery.Count(&total)
\tpage, size := intOr(q, "page", 1), intOr(q, "pageSize", 20)
\tvar rows []Order
\tquery.Offset((page - 1) * size).Limit(size).Find(&rows)
\twriteJSON(w, http.StatusOK, map[string]any{
\t\t"data": rows,
\t\t"meta": map[string]any{"total": total},
\t})
}`,
  },
]

const listOrders = (provider: DataProvider): Promise<unknown> => provider.getList({ resource: 'orders', pagination: { page: 1, pageSize: 3 }, filters: [{ field: 'status', operator: 'eq', value: 'paid' }, { field: 'total', operator: 'gte', value: 100 }], sorters: [{ field: 'total', order: 'desc' }] })

function ListExample(): ReactElement {
  const t = useTranslate()
  const { exchange, run } = useRecorder()
  useOnMount(() => run(listOrders))
  return (
    <LumiCodeExample
      title={t('A list with filters, sorting and pages')}
      code={<Code files={LIST_FILES} />}
      previewLabel={t('Response')}
      previewActions={<Button label={t('List with filter, sort and page')} appearance="ghost" size="sm" icon="refresh" onClick={() => run(listOrders)} />}
      preview={<ExchangeView exchange={exchange} />}
    />
  )
}

function OneExample(): ReactElement {
  const t = useTranslate()
  const { exchange, run } = useRecorder()
  const read = (provider: DataProvider): Promise<unknown> => provider.getOne({ resource: 'customers', id: 1 })
  useOnMount(() => run(read))
  return (
    <LumiCodeExample
      title={t('One record')}
      code={(
        <Code files={[
          { name: 'page.json', language: 'json', code: json({ type: 'Query', props: { resource: 'customers', operation: 'one', id: 1, resultPath: '/customer' }, children: [] }) },
          { name: 'hooks.ts', language: 'ts', code: `const { data } = await dataProvider.getOne({\n  resource: 'customers',\n  id: 1,\n})` },
          { name: 'customers.go', language: 'go', code: `// GET /customers/{id}\nfunc showCustomer(w http.ResponseWriter, r *http.Request) {\n\tvar customer Customer\n\tif db.First(&customer, r.PathValue("id")).Error != nil {\n\t\twriteError(w, http.StatusNotFound, "customer not found")\n\t\treturn\n\t}\n\twriteJSON(w, http.StatusOK, map[string]any{"data": customer})\n}` },
        ]}
        />
      )}
      previewLabel={t('Response')}
      previewActions={<Button label={t('Run getOne')} appearance="ghost" size="sm" icon="refresh" onClick={() => run(read)} />}
      preview={<ExchangeView exchange={exchange} />}
    />
  )
}

const MUTATION_FILES: readonly CodeFile[] = [
  {
    name: 'page.json',
    language: 'json',
    code: json({
      create: { action: 'create', params: { resource: 'notes', values: { title: 'Call the courier', priority: 'low' }, resultPath: '/created' } },
      update: { action: 'update', params: { resource: 'notes', id: { $state: '/created/data/id' }, values: { priority: 'high' } } },
      remove: { action: 'delete', params: { resource: 'notes', id: { $state: '/created/data/id' } } },
    }),
  },
  {
    name: 'hooks.ts',
    language: 'ts',
    code: `const create = useCreate({ resource: 'notes' })
const update = useUpdate({ resource: 'notes' })
const remove = useDelete({ resource: 'notes' })

const { data } = await create.mutateAsync({
  variables: { title: 'Call the courier', priority: 'low' },
})
await update.mutateAsync({ id: data.id, variables: { priority: 'high' } })
await remove.mutateAsync({ id: data.id })
// Each mutation invalidates the notes queries.`,
  },
]

function MutationExample(): ReactElement {
  const t = useTranslate()
  const { exchange, run } = useRecorder()
  const [id, setId] = useState<number>()
  const create = (): void => run(async (provider) => {
    const result = await provider.create({ resource: 'notes', variables: { title: `Call the courier ${Date.now() % 10000}`, priority: 'low' } })
    setId(Number((result.data as { id: number }).id))
  })
  return (
    <LumiCodeExample
      title={t('Create, update and delete')}
      code={<Code files={MUTATION_FILES} />}
      previewLabel={t('Response')}
      previewActions={(
        <>
          <Button label={t('Create')} appearance="ghost" size="sm" onClick={create} />
          <Button label={t('Update')} appearance="ghost" size="sm" disabled={id === undefined} onClick={() => run(provider => provider.update({ resource: 'notes', id: id!, variables: { priority: 'high' } }))} />
          <Button
            label={t('Delete')}
            appearance="ghost"
            size="sm"
            disabled={id === undefined}
            onClick={() => run(async (provider) => {
              await provider.deleteOne({ resource: 'notes', id: id! })
              setId(undefined)
            })}
          />
        </>
      )}
      preview={<ExchangeView exchange={exchange} empty={t('Create a note, then update or delete it')} />}
    />
  )
}

function CustomExample(): ReactElement {
  const t = useTranslate()
  const { exchange, run } = useRecorder()
  const read = (provider: DataProvider): Promise<unknown> => provider.custom!({ url: '/orders/stats' })
  useOnMount(() => run(read))
  return (
    <LumiCodeExample
      title={t('Custom endpoints')}
      code={(
        <Code files={[
          { name: 'page.json', language: 'json', code: json({ action: 'request', params: { url: '/orders/stats', resultPath: '/stats' } }) },
          { name: 'hooks.ts', language: 'ts', code: `const { data } = await dataProvider.custom({\n  url: '/orders/stats',\n})` },
        ]}
        />
      )}
      previewLabel={t('Response')}
      previewActions={<Button label={t('Run custom')} appearance="ghost" size="sm" icon="refresh" onClick={() => run(read)} />}
      preview={<ExchangeView exchange={exchange} />}
    />
  )
}

const ADAPTER: CodeFile = {
  name: 'legacy-provider.ts',
  language: 'ts',
  code: `import type { DataProvider } from '@duxweb/lumi'
import { DataProviderError } from '@duxweb/lumi'

// An existing API: { code, msg, data: { list, total } }.
async function call(path: string, body?: unknown) {
  const response = await fetch(\`/api/\${path}\`, body === undefined
    ? undefined
    : { method: 'POST', body: JSON.stringify(body) })
  const { code, msg, data, fields } = await response.json()
  if (code !== 0)
    throw new DataProviderError({ status: 422, message: msg, errors: fields })
  return data
}

export const legacyProvider: DataProvider = {
  async getList({ resource, pagination }) {
    const page = pagination ? pagination.page : 1
    const data = await call(\`\${resource}/list?p=\${page}\`)
    return { data: data.list, total: data.total }
  },
  getOne: async ({ resource, id }) =>
    ({ data: await call(\`\${resource}/info?id=\${id}\`) }),
  create: async ({ resource, variables }) =>
    ({ data: await call(\`\${resource}/add\`, variables) }),
  update: async ({ resource, id, variables }) =>
    ({ data: await call(\`\${resource}/edit?id=\${id}\`, variables) }),
  deleteOne: async ({ resource, id }) =>
    ({ data: await call(\`\${resource}/del?id=\${id}\`, {}) }),
}

// createLumi({ dataProvider: { default: rest, legacy: legacyProvider } })
// then "dataProviderName": "legacy" on an element or an action.`,
}

const adapterColumns = perLocale((t): TableColumn[] => ([
  { field: 'call', label: t('Lumi call'), kind: 'code', width: '8rem' },
  { field: 'http', label: t('Legacy endpoint'), kind: 'code', wrap: true },
]))

const ADAPTER_ROWS = [
  { id: 1, call: 'getList', http: 'GET /api/orders/list?p=1' },
  { id: 2, call: 'getOne', http: 'GET /api/orders/info?id=1' },
  { id: 3, call: 'create', http: 'POST /api/orders/add' },
  { id: 4, call: 'update', http: 'POST /api/orders/edit?id=1' },
  { id: 5, call: 'deleteOne', http: 'POST /api/orders/del?id=1' },
  { id: 6, call: 'code ≠ 0', http: 'DataProviderError 422 { message, errors }' },
]

const STRAPI: CodeFile = {
  name: 'strapi-provider.ts',
  language: 'ts',
  code: `import type { DataProvider } from '@duxweb/lumi'

// Strapi v5 REST: filters[field][$op], pagination[page], sort=field:dir,
// and { data, meta: { pagination: { total } } } in every list answer.
export function strapiDataProvider(url: string, getJwt: () => string | undefined): DataProvider {
  const call = async (path: string, init: RequestInit = {}) => {
    const jwt = getJwt()
    const response = await fetch(\`\${url}/api/\${path}\`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: \`Bearer \${jwt}\` } : {}) },
    })
    const body = await response.json()
    if (!response.ok)
      throw Object.assign(new Error(body.error?.message), { status: response.status })
    return body
  }
  return {
    getList: async ({ resource, pagination, filters = [], sorters = [] }) => {
      const query = new URLSearchParams()
      if (pagination) {
        query.set('pagination[page]', String(pagination.page))
        query.set('pagination[pageSize]', String(pagination.pageSize))
      }
      for (const f of filters)
        query.set(\`filters[\${f.field}][$\${f.operator}]\`, String(f.value))
      if (sorters.length)
        query.set('sort', sorters.map(s => \`\${s.field}:\${s.order}\`).join(','))
      const body = await call(\`\${resource}?\${query}\`)
      return { data: body.data, total: body.meta.pagination.total }
    },
    getOne: async ({ resource, id }) => ({ data: (await call(\`\${resource}/\${id}\`)).data }),
    create: async ({ resource, variables }) =>
      ({ data: (await call(resource, { method: 'POST', body: JSON.stringify({ data: variables }) })).data }),
    update: async ({ resource, id, variables }) =>
      ({ data: (await call(\`\${resource}/\${id}\`, { method: 'PUT', body: JSON.stringify({ data: variables }) })).data }),
    deleteOne: async ({ resource, id }) =>
      ({ data: (await call(\`\${resource}/\${id}\`, { method: 'DELETE' })).data }),
  }
}`,
}

const STRAPI_ROWS = [
  { id: 1, call: 'filters', http: 'filters[status][$eq]=paid' },
  { id: 2, call: 'pagination', http: 'pagination[page]=1&pagination[pageSize]=20' },
  { id: 3, call: 'sorters', http: 'sort=total:desc' },
  { id: 4, call: 'total', http: 'meta.pagination.total' },
  { id: 5, call: 'token', http: 'Authorization: Bearer <jwt>' },
]

const SOURCE_FILES: readonly CodeFile[] = [
  {
    name: 'main.tsx',
    language: 'tsx',
    code: `mountAdmin(config, {
  // The panel's data stays the default; more backends sit beside it by name.
  dataProviders: {
    local: localDataProvider,
    cms: strapiDataProvider('https://cms.example.com', getJwt),
  },
})`,
  },
  {
    name: 'manifest.json',
    language: 'json',
    code: json({ name: 'content', path: '/content', dataProvider: 'cms', children: [{ name: 'articles', path: 'articles', page: { src: 'pages/articles.json' } }] }),
  },
  {
    name: 'hooks.tsx',
    language: 'tsx',
    code: `useList({ resource: 'orders' })                              // the panel's data
useList({ resource: 'warehouses', dataProviderName: 'local' }) // named
// Under /content every call uses \`cms\` unless it names another.`,
  },
]

function SourcesExample(): ReactElement {
  const t = useTranslate()
  const orders = useList<Record<string, unknown>>({ resource: 'orders', pagination: { page: 1, pageSize: 3 } })
  const warehouses = useList<Record<string, unknown>>({ resource: 'warehouses', dataProviderName: 'local' })
  return (
    <LumiCodeExample
      title={t('Two data providers on one page')}
      code={<Code files={SOURCE_FILES} />}
      previewLabel={t('Result')}
      preview={(
        <Stack gap="md">
          <Table rowKey="id" aria-label={t('Orders from the default backend')} loading={orders.isPending} rows={orders.data?.data ?? []} columns={[{ field: 'number', label: t('Orders · default') }, { field: 'total', label: t('Total'), align: 'right' }]} />
          <Table rowKey="id" aria-label={t('Warehouses from local')} loading={warehouses.isPending} rows={warehouses.data?.data ?? []} columns={[{ field: 'name', label: t('Warehouses · local') }, { field: 'stock', label: t('Stock'), align: 'right' }]} />
        </Stack>
      )}
    />
  )
}

export function AdminBackendDataRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Data API')} description={t('createSimpleDataProvider\'s REST convention, sent live to the mock API')}>
      <LumiCodeExample
        title={t('The contract at a glance')}
        code={<Code files={[{ name: 'contract.http', language: 'http', code: CONTRACT }]} />}
      />
      <ListExample />
      <OneExample />
      <MutationExample />
      <CustomExample />
      <LumiCodeExample
        title={t('Adapting another API')}
        code={<Code files={[ADAPTER]} />}
        previewLabel={t('Mapping')}
        align="center"
        preview={<Table rowKey="id" columns={adapterColumns(t)} rows={ADAPTER_ROWS} />}
      />
      <LumiCodeExample
        title={t('A Strapi data provider')}
        code={<Code files={[STRAPI]} />}
        previewLabel={t('Mapping')}
        align="center"
        preview={<Table rowKey="id" columns={adapterColumns(t)} rows={STRAPI_ROWS} />}
      />
      <SourcesExample />
    </DeveloperPage>
  )
}

/* -------------------------------------------------------------------------- */
/* Error handling                                                             */

const FIELD_ERROR_FILES: readonly CodeFile[] = [
  {
    name: '422.http',
    language: 'http',
    code: `POST /notes
Accept-Language: en-US

{ "title": "Review the Chengdu backlog", "priority": "normal" }

HTTP/1.1 422 Unprocessable Entity

${json({ message: 'Validation failed', code: 'invalid', errors: [{ path: 'title', code: 'taken', message: 'A note with this title already exists.' }] })}`,
  },
  {
    name: 'notes.go',
    language: 'go',
    code: `type FieldError struct {
\tPath    string \`json:"path"\`
\tCode    string \`json:"code,omitempty"\`
\tMessage string \`json:"message"\`
}

func createNote(w http.ResponseWriter, r *http.Request) {
\tvar note Note
\tif json.NewDecoder(r.Body).Decode(&note) != nil {
\t\twriteError(w, http.StatusBadRequest, "invalid JSON")
\t\treturn
\t}
\t// Messages follow Accept-Language; forms show them as sent.
\tif notes.TitleTaken(note.Title) {
\t\twriteJSON(w, http.StatusUnprocessableEntity, map[string]any{
\t\t\t"message": tr(r, "Validation failed"),
\t\t\t"code":    "invalid",
\t\t\t"errors": []FieldError{{
\t\t\t\tPath:    "title",
\t\t\t\tCode:    "taken",
\t\t\t\tMessage: tr(r, "A note with this title already exists."),
\t\t\t}},
\t\t})
\t\treturn
\t}
\tnotes.Insert(&note)
\twriteJSON(w, http.StatusCreated, map[string]any{"data": note})
}`,
  },
]

const UNAUTHORIZED_FILES: readonly CodeFile[] = [
  {
    name: 'auth-provider.ts',
    language: 'ts',
    code: `// createSimpleAuthProvider does this already; a custom
// AuthProvider decides the same way.
const authProvider: AuthProvider = {
  // …login, logout, check, getIdentity, getPermissions
  async onError(error) {
    if (error.status !== 401)
      return {}
    clearToken()
    // Lumi signs out, clears every cached query and
    // opens the sign-in page.
    return { logout: true, redirectTo: '/login' }
  },
}`,
  },
  { name: '401.http', language: 'http', code: `GET /orders\nAuthorization: Bearer expired-token\n\nHTTP/1.1 401 Unauthorized\n\n${json({ message: 'unauthorized' })}` },
]

function UnauthorizedExample(): ReactElement {
  const t = useTranslate()
  const { exchange, run } = useRecorder({ token: 'Bearer expired-token' })
  const read = (provider: DataProvider): Promise<unknown> => provider.getList({ resource: 'orders', pagination: { page: 1, pageSize: 1 } })
  useOnMount(() => run(read))
  return (
    <LumiCodeExample
      title={t('401 ends the session')}
      code={<Code files={UNAUTHORIZED_FILES} />}
      previewLabel={t('Response')}
      previewActions={<Button label={t('Send with an expired token')} appearance="ghost" size="sm" icon="refresh" onClick={() => run(read)} />}
      preview={<ExchangeView exchange={exchange} />}
    />
  )
}

const STATUS_PROBES = perLocale(t => ([
  { label: t('403 Forbidden'), flag: '__forbidden' },
  { label: t('500 Server error'), flag: '__error' },
  { label: t('503 Offline'), flag: '__offline' },
  { label: t('504 Timeout'), flag: '__timeout' },
] as const))

const PROBE_SOURCE: CodeFile = {
  name: 'hooks.ts',
  language: 'ts',
  code: `import { DataProviderError } from '@duxweb/lumi'

try {
  await dataProvider.getList({ resource: 'notes' })
}
catch (error) {
  if (error instanceof DataProviderError) {
    error.status // 403
    error.code // 'forbidden'
    error.message // 'forbidden'
    error.errors // field errors on a 422
  }
}
// Hooks and Queries expose it as error;
// JSON actions reach onError with it.`,
}

function StatusExample(): ReactElement {
  const t = useTranslate()
  const { exchange, run } = useRecorder()
  const [failure, setFailure] = useState<{ status?: unknown, code?: unknown, message: string }>()
  const probe = (flag: string): void => run(provider => provider.getList({ resource: 'notes', meta: { [flag]: 1 } }).then(
    () => setFailure(undefined),
    (error: { status?: unknown, code?: unknown, message: string }) => setFailure({ status: error.status, code: error.code, message: error.message }),
  ))
  useOnMount(() => probe('__forbidden'))
  return (
    <LumiCodeExample
      title={t('403, 5xx and timeouts')}
      code={<Code files={[PROBE_SOURCE]} />}
      previewLabel={t('Result')}
      previewActions={STATUS_PROBES(t).map(item => <Button key={item.flag} label={item.label} appearance="ghost" size="sm" onClick={() => probe(item.flag)} />)}
      preview={(
        <>
          {failure && <Alert tone="danger" title={`DataProviderError ${String(failure.status)}`} message={`${failure.message}${failure.code ? ` (code: ${String(failure.code)})` : ''}`} />}
          <ExchangeView exchange={exchange} empty={t('Choose a status above')} />
        </>
      )}
    />
  )
}

export function AdminBackendErrorsRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Error handling')} description={t('Failure statuses and field errors, and how each layer shows them')}>
      <SpecExample
        title={t('422 with field errors')}
        spec={errorSpecs.fields}
        files={FIELD_ERROR_FILES}
      />
      <UnauthorizedExample />
      <StatusExample />
      <SpecExample
        title={t('Failures inside a Spec')}
        spec={errorSpecs.outage}
        showState={false}
      />
      <SpecExample
        title={t('Unhandled failures become a toast')}
        spec={errorSpecs.unhandled}
      />
    </DeveloperPage>
  )
}

/* -------------------------------------------------------------------------- */
/* Auth API                                                                   */

const LOGIN_FILES: readonly CodeFile[] = [
  {
    name: 'login.http',
    language: 'http',
    code: `POST /login
Content-Type: application/json

${json({ username: 'admin', password: '••••' })}

HTTP/1.1 200 OK

${json({ data: { token: 'lumi-admin-admin', user: { id: 1, name: 'Ada Admin', role: 'admin' }, permissions: ['*:*'] } })}`,
  },
  {
    name: 'auth.go',
    language: 'go',
    code: `func login(w http.ResponseWriter, r *http.Request) {
\tvar form struct{ Username, Password string }
\tjson.NewDecoder(r.Body).Decode(&form)
\tuser, err := users.Verify(form.Username, form.Password)
\tif err != nil {
\t\twriteError(w, http.StatusUnauthorized,
\t\t\ttr(r, "Incorrect username or password"))
\t\treturn
\t}
\twriteJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
\t\t"token":       sessions.Issue(user),
\t\t"user":        user,
\t\t"permissions": user.Permissions(), // ["orders:*", …]
\t}})
}`,
  },
]

function LoginExample(): ReactElement {
  const t = useTranslate()
  const { exchange, run } = useRecorder({ token: '' })
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin')
  return (
    <LumiCodeExample
      title={t('Sign in')}
      code={<Code files={LOGIN_FILES} />}
      previewLabel={t('Response')}
      preview={(
        <>
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            <Input ariaLabel={t('Username')} value={username} onChange={value => setUsername(String(value ?? ''))} />
            <Input ariaLabel={t('Password')} type="password" value={password} onChange={value => setPassword(String(value ?? ''))} />
            <Button label="POST /login" onClick={() => run(provider => provider.custom!({ url: '/login', method: 'POST', payload: { username, password } }))} />
          </Stack>
          <ExchangeView exchange={exchange} empty={t('Send the form to see the answer')} />
        </>
      )}
    />
  )
}

const ME_FILES: readonly CodeFile[] = [
  {
    name: 'me.http',
    language: 'http',
    code: `GET /me
Authorization: Bearer lumi-admin-admin

HTTP/1.1 200 OK

${json({ data: { user: { id: 1, name: 'Ada Admin' }, permissions: ['*:*'] } })}

POST /logout
Authorization: Bearer lumi-admin-admin

HTTP/1.1 200 OK`,
  },
  {
    name: 'auth.go',
    language: 'go',
    code: `// Both sit behind the bearer middleware; a missing or
// expired token answers 401 before they run.
func me(w http.ResponseWriter, r *http.Request) {
\tuser := auth.User(r.Context())
\twriteJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
\t\t"user":        user,
\t\t"permissions": user.Permissions(),
\t}})
}

func logout(w http.ResponseWriter, r *http.Request) {
\tsessions.Revoke(auth.Token(r))
\twriteJSON(w, http.StatusOK, map[string]any{"data": true})
}`,
  },
]

function SessionExample(): ReactElement {
  const t = useTranslate()
  const { exchange, run } = useRecorder()
  const read = (provider: DataProvider): Promise<unknown> => provider.custom!({ url: '/me' })
  useOnMount(() => run(read))
  return (
    <LumiCodeExample
      title={t('Restore the session')}
      code={<Code files={ME_FILES} />}
      previewLabel={t('Response')}
      previewActions={<Button label="GET /me" appearance="ghost" size="sm" icon="refresh" onClick={() => run(read)} />}
      preview={<ExchangeView exchange={exchange} />}
    />
  )
}

const PERMISSION_CHECKS = [
  { resource: 'orders', action: 'list' },
  { resource: 'orders', action: 'edit' },
  { resource: 'products', action: 'delete' },
  { resource: 'roles', action: 'edit' },
] as const

function PermissionRow({ resource, action }: { resource: string, action: string }): ReactElement {
  const t = useTranslate()
  const can = useCan({ resource, action })
  return (
    <Stack direction="horizontal" gap="sm" align="center" justify="between">
      <Badge appearance="outline" label={`${resource}:${action}`} />
      <Badge tone={can.data?.can ? 'success' : 'neutral'} label={can.isPending ? '…' : can.data?.can ? t('Allowed') : t('Denied')} />
    </Stack>
  )
}

const PERMISSION_FILES: readonly CodeFile[] = [
  {
    name: 'access.ts',
    language: 'ts',
    code: `// createSimpleAuthProvider's check: the exact code,
// a resource wildcard, or *:*.
const accessProvider: AccessProvider = {
  async can({ resource, action }) {
    const granted = session.permissions
    return {
      can: granted.includes(\`\${resource}:\${action}\`)
        || granted.includes(\`\${resource}:*\`)
        || granted.includes('*:*'),
    }
  },
}`,
  },
  {
    name: 'manifest.json',
    language: 'json',
    code: json({ name: 'product-form', path: '/products/new', access: { resource: 'products', action: 'create' } }),
  },
  { name: 'hooks.ts', language: 'ts', code: `const { data } = useCan({ resource: 'orders', action: 'edit' })\n// data.can: boolean` },
]

function PermissionExample(): ReactElement {
  const t = useTranslate()
  return (
    <LumiCodeExample
      title={t('Permissions')}
      code={<Code files={PERMISSION_FILES} />}
      previewLabel={t('Your account')}
      align="center"
      preview={<Stack gap="sm">{PERMISSION_CHECKS.map(check => <PermissionRow key={`${check.resource}:${check.action}`} {...check} />)}</Stack>}
    />
  )
}

function ConfigExample(): ReactElement {
  const t = useTranslate()
  const { defaultData, auth } = mountedPanel()
  const endpoints = { login: '/login', logout: '/logout', me: '/me', ...auth.endpoints }
  return (
    <LumiCodeExample
      title={t('Configure the provider')}
      code={(
        <Code files={[
          { name: 'config.json', language: 'json', code: json({ data: { url: 'https://api.example.com' }, auth: { tokenKey: 'shop_token', endpoints: { login: '/login', logout: '/logout', me: '/me' } } }) },
          {
            name: 'main.tsx',
            language: 'tsx',
            code: `import { createHttpClient, createLumi, createSimpleAuthProvider, createSimpleDataProvider } from '@duxweb/lumi'

const apiUrl = 'https://api.example.com'
const auth = createSimpleAuthProvider({ apiUrl, tokenKey: 'shop_token' })
// One client for every request, signed by the auth provider.
const http = createHttpClient({ authProvider: auth.authProvider })
const lumi = createLumi({
  dataProvider: createSimpleDataProvider({ apiUrl, http }),
  http,
  authProvider: auth.authProvider,
  accessProvider: auth.accessProvider,
})`,
          },
        ]}
        />
      )}
      previewLabel={t('This demo')}
      align="center"
      preview={(
        <DescriptionList
          items={[
            { label: t('API root'), value: defaultData.url },
            { label: t('Token key'), value: auth.tokenKey ?? 'lumi_token' },
            { label: 'login', value: `POST ${endpoints.login}` },
            { label: 'me', value: `GET ${endpoints.me}` },
            { label: 'logout', value: `POST ${endpoints.logout}` },
          ]}
        />
      )}
    />
  )
}

export function AdminBackendAuthRoute(): ReactElement {
  const t = useTranslate()
  return (
    <DeveloperPage title={t('Auth API')} description={t('Sign-in, session restore and permissions with createSimpleAuthProvider')}>
      <LoginExample />
      <SessionExample />
      <PermissionExample />
      <ConfigExample />
    </DeveloperPage>
  )
}
