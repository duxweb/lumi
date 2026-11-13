import { z } from 'zod'
import { FILTER_OPERATORS } from '../core/types.js'

/**
 * Where a choice control reads its options from: one DataProvider resource,
 * searched, paged and filtered on the server. `dependsOn` maps a filter field
 * to the JSON Pointer of the state value it follows, e.g. a city list
 * filtered by `{ "parentId": "/form/province" }`.
 */
export const optionsSourceSchema = z.strictObject({
  resource: z.string().min(1),
  dataProviderName: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  filters: z.array(z.object({ field: z.string(), operator: z.enum(FILTER_OPERATORS), value: z.unknown() })).optional(),
  labelField: z.string().optional(),
  valueField: z.string().optional(),
  descriptionField: z.string().optional(),
  avatarField: z.string().optional(),
  imageField: z.string().optional(),
  searchField: z.string().optional(),
  pageSize: z.number().int().positive().optional(),
  dependsOn: z.record(z.string(), z.string().startsWith('/')).optional(),
  clearOnDependencyChange: z.boolean().optional(),
})

export type OptionsSource = z.input<typeof optionsSourceSchema>
