import  { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react'
import { apiGet } from '../api'

const DataCacheContext = createContext(null)
const DEFAULT_TTL = 5 * 60 * 1000

export function DataCacheProvider({ children }) {
  const cacheRef = useRef(new Map())
  const [, forceRender] = useState(0)
  const versionRef = useRef(0)

  const get = useCallback((key) => {
    const entry = cacheRef.current.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > entry.ttl) {
      cacheRef.current.delete(key)
      return null
    }
    return entry.data
  }, [])

  const set = useCallback((key, data, ttl = DEFAULT_TTL) => {
    cacheRef.current.set(key, { data, timestamp: Date.now(), ttl })
  }, [])

  const invalidate = useCallback((pattern) => {
    if (!pattern) {
      cacheRef.current.clear()
      versionRef.current++
      forceRender((v) => v + 1)
      return
    }
    for (const key of cacheRef.current.keys()) {
      if (key.startsWith(pattern)) {
        cacheRef.current.delete(key)
      }
    }
    versionRef.current++
    forceRender((v) => v + 1)
  }, [])

  return (
    <DataCacheContext.Provider value={{ get, set, invalidate, version: versionRef }}>
      {children}
    </DataCacheContext.Provider>
  )
}

export function useDataCache() {
  const ctx = useContext(DataCacheContext)
  if (!ctx) throw new Error('useDataCache must be used within DataCacheProvider')
  return ctx
}

export function useCachedApiGet(endpoint, deps = []) {
  const { get: cacheGet, set: cacheSet } = useDataCache()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      const cached = cacheGet(endpoint)
      if (cached) {
        if (!cancelled) {
          setData(cached)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const res = await apiGet(endpoint)
        if (cancelled) return
        if (!res.ok) {
          setError(`HTTP ${res.status}`)
          setLoading(false)
          return
        }
        const json = await res.json()
        cacheSet(endpoint, json)
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Network error')
          setLoading(false)
        }
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [endpoint, ...deps])

  return { data, loading, error }
}
