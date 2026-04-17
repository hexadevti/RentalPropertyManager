import { useEffect } from 'react'

export function useKVCleanup() {
  useEffect(() => {
    // Spark KV cleanup is no longer required after migrating persistence to Supabase.
  }, [])
}
