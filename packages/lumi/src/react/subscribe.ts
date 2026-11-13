interface Subscribable {
  subscribe?: (listener: () => void) => () => void
}

/** For useSyncExternalStore when there is nothing to listen to. */
export function noSubscribe(): () => void {
  return () => {}
}

export function subscribeToProvider(provider: Subscribable | undefined, listener: () => void): () => void {
  return provider?.subscribe?.(listener) ?? (() => {})
}
