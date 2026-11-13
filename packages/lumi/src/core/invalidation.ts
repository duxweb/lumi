import type { QueryClient } from '@tanstack/query-core'
import type { ID, LumiContext } from './index.js'
import { isOneQueryKeyForIds, resolveDataTarget, resourceQueryKey } from './index.js'

/** Refetches a resource's queries after a write; the record queries of `deletedIds` are marked stale but not fetched again. */
export async function invalidateResourceQueries(queryClient: QueryClient, lumi: LumiContext, resource: string, dataProviderName?: string, deletedIds?: readonly ID[]): Promise<void> {
  const target = resolveDataTarget(lumi, { resource, dataProviderName })
  const queryKey = resourceQueryKey(resource, target.dataProviderName)
  if (!deletedIds?.length) {
    await queryClient.invalidateQueries({ queryKey }, { throwOnError: true })
    return
  }

  await queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
  await queryClient.refetchQueries({
    queryKey,
    type: 'active',
    predicate: query => !isOneQueryKeyForIds(query.queryKey, deletedIds),
  }, { throwOnError: true })
}
