import { useEffect, useState } from 'react'
import { fetchBcraValuacionArsPerUsd, type BcraValuacionQuote } from '../lib/bcraValuacionUsd'

export function useBcraValuacionUsd() {
  const [quote, setQuote] = useState<BcraValuacionQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    void fetchBcraValuacionArsPerUsd(ac.signal)
      .then((q) => {
        setQuote(q)
        setError(null)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setQuote(null)
        setError(e instanceof Error ? e.message : 'No se pudo obtener la cotización')
      })
      .finally(() => {
        setLoading(false)
      })
    return () => ac.abort()
  }, [])

  return { quote, loading, error, arsPerUsd: quote?.arsPerUsd ?? null }
}
