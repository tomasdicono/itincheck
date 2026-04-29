import { useEffect, useState } from 'react'
import { fetchUsdArsSellQuote, type UsdArsQuote } from '../lib/usdArsSellQuote'

export function useBcraValuacionUsd() {
  const [quote, setQuote] = useState<UsdArsQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    void fetchUsdArsSellQuote(ac.signal)
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
