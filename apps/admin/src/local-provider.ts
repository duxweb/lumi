import type { DataProvider } from '@duxweb/lumi'

// A second backend for the showcase: an in-memory store behind the same
// DataProvider interface, registered as `local` beside the mock REST API.
const stores: Record<string, Array<Record<string, unknown>>> = {
  warehouses: [
    { id: 1, name: 'Shanghai DC', stock: 1840 },
    { id: 2, name: 'Chengdu DC', stock: 920 },
    { id: 3, name: 'Shenzhen DC', stock: 1310 },
  ],
}

const rows = (resource: string): Array<Record<string, unknown>> => (stores[resource] ??= [])

export const localDataProvider = {
  getList: async ({ resource, pagination }) => {
    const all = rows(resource)
    const paging = pagination || undefined
    const page = paging?.page ?? 1
    const size = paging?.pageSize ?? all.length
    return { data: all.slice((page - 1) * size, page * size) as never[], total: all.length }
  },
  getOne: async ({ resource, id }) => ({ data: rows(resource).find(row => String(row.id) === String(id)) as never }),
  create: async ({ resource, variables }) => {
    const row = { id: Math.max(0, ...rows(resource).map(entry => Number(entry.id))) + 1, ...(variables as object) }
    rows(resource).push(row)
    return { data: row as never }
  },
  update: async ({ resource, id, variables }) => {
    const row = rows(resource).find(entry => String(entry.id) === String(id))
    Object.assign(row ?? {}, variables)
    return { data: row as never }
  },
  deleteOne: async ({ resource, id }) => {
    const list = rows(resource)
    const at = list.findIndex(entry => String(entry.id) === String(id))
    const [row] = at >= 0 ? list.splice(at, 1) : []
    return { data: row as never }
  },
} satisfies DataProvider
