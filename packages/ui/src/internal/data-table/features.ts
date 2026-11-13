import { columnOrderingFeature, columnVisibilityFeature, rowSelectionFeature, rowSortingFeature, tableFeatures } from '@tanstack/react-table'

/**
 * Keep the adapter's table engine intentionally small. Filtering and pagination
 * remain server-owned through Lumi's data hooks, so registering those features
 * here would create a second, conflicting source of truth.
 */
export const lumiDataTableFeatures = tableFeatures({
  columnOrderingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
})

export type LumiDataTableFeatures = typeof lumiDataTableFeatures
