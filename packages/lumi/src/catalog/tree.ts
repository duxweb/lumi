import { z } from 'zod'
import { FILTER_OPERATORS } from '../core/types.js'

/**
 * Where a hierarchical control (Tree, TreeSelect, Cascader, CascaderPanel)
 * reads its nodes from: one DataProvider resource. Rows are either nested
 * under `childrenField` or flat and linked by `parentField`. With `lazy`,
 * each level is requested when its parent opens, filtered by
 * `parentField = <parent value>`; root rows have an empty parent unless
 * `rootValue` names one.
 */
export const treeSourceSchema = z.strictObject({
  /** The resource the nodes come from. */
  resource: z.string().min(1),
  dataProviderName: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  /** Conditions every request carries. */
  filters: z.array(z.object({ field: z.string(), operator: z.enum(FILTER_OPERATORS), value: z.unknown() })).optional(),
  /** The field shown; the first of `label`, `name`, `title` with a value, else the id, when left out. */
  labelField: z.string().optional(),
  /** The field used as a node's value; `id` by default. */
  valueField: z.string().optional(),
  /** The field linking a flat row to its parent; `parentId` by default. */
  parentField: z.string().optional(),
  /** The field holding a row's nested children, for a backend that answers a tree. */
  childrenField: z.string().optional(),
  /** A field telling whether a row has no children, so a lazy node shows no expander. */
  leafField: z.string().optional(),
  /** Requests each level when its parent opens, instead of the whole resource once. */
  lazy: z.boolean().optional(),
  /** The parent value of root rows; rows with an empty parent when left out. */
  rootValue: z.union([z.string(), z.number()]).optional(),
  /** The field a search filters with `like` on the server; a lazy source needs it to search. */
  searchField: z.string().optional(),
  /** Rows per request; 1000 by default. */
  pageSize: z.number().int().positive().optional(),
})

export type TreeSource = z.input<typeof treeSourceSchema>
