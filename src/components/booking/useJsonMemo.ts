/**
 * A value rebuilt from its JSON only when the JSON changes: equal inputs
 * (fresh default objects every render) keep one identity, so nothing
 * downstream re-runs.
 */
import { useMemo } from 'react'

export function useJsonMemo<T>(json: string): T {
  return useMemo(() => JSON.parse(json) as T, [json])
}
