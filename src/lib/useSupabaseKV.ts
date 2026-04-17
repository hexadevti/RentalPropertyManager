import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { supabase } from '@/lib/supabase'

type KVRow = {
  key: string
  value: unknown
}

const cache = new Map<string, unknown>()
const subscribers = new Map<string, Set<(value: unknown) => void>>()
const inflightLoads = new Map<string, Promise<unknown>>()

function notifySubscribers(key: string, value: unknown) {
  const keySubscribers = subscribers.get(key)
  if (!keySubscribers) return

  for (const callback of keySubscribers) {
    callback(value)
  }
}

function subscribeToKey(key: string, callback: (value: unknown) => void) {
  const currentSubscribers = subscribers.get(key) ?? new Set<(value: unknown) => void>()
  currentSubscribers.add(callback)
  subscribers.set(key, currentSubscribers)

  return () => {
    const set = subscribers.get(key)
    if (!set) return
    set.delete(callback)
    if (set.size === 0) {
      subscribers.delete(key)
    }
  }
}

async function loadValue<T>(key: string, defaultValue: T): Promise<T> {
  if (cache.has(key)) {
    return cache.get(key) as T
  }

  const inflight = inflightLoads.get(key)
  if (inflight) {
    return (await inflight) as T
  }

  const request = (async () => {
    const { data, error } = await supabase
      .from('app_kv')
      .select('key, value')
      .eq('key', key)
      .maybeSingle<KVRow>()

    if (error) {
      console.error(`Failed to load key \"${key}\" from Supabase`, error)
      cache.set(key, defaultValue)
      return defaultValue
    }

    const resolved = (data?.value ?? defaultValue) as T
    cache.set(key, resolved)
    return resolved
  })()

  inflightLoads.set(key, request)

  try {
    return await request
  } finally {
    inflightLoads.delete(key)
  }
}

async function persistValue<T>(key: string, value: T) {
  const { error } = await supabase
    .from('app_kv')
    .upsert({ key, value }, { onConflict: 'key' })

  if (error) {
    throw error
  }
}

export function useKV<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const defaultValueRef = useRef(defaultValue)
  const [value, setValue] = useState<T>(defaultValue)

  useEffect(() => {
    defaultValueRef.current = defaultValue
  }, [defaultValue])

  useEffect(() => {
    let isMounted = true

    const sync = async () => {
      const loaded = await loadValue<T>(key, defaultValueRef.current)
      if (!isMounted) return
      setValue(loaded)
      notifySubscribers(key, loaded)
    }

    void sync()

    const unsubscribe = subscribeToKey(key, (nextValue) => {
      setValue(nextValue as T)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [key])

  const setKVValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue((current) => {
      const base = (cache.has(key) ? cache.get(key) : current) as T
      const resolved = next instanceof Function ? next(base) : next

      cache.set(key, resolved)
      notifySubscribers(key, resolved)

      void persistValue(key, resolved).catch((error) => {
        console.error(`Failed to persist key \"${key}\" to Supabase`, error)
      })

      return resolved
    })
  }, [key])

  return useMemo(() => [value, setKVValue], [value, setKVValue])
}
