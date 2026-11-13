import { useEffect, useState } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** Tracks the reader's reduced-motion preference, for motion CSS cannot switch off on its own. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function')
      return
    const query = matchMedia(REDUCED_MOTION)
    const update = (): void => setReduced(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return reduced
}
