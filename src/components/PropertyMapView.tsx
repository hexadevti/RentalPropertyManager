import { useEffect, useRef, useState, useCallback } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import { Property, PropertyStatus } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency } from '@/lib/CurrencyContext'

interface Props {
  properties: Property[]
  getPropertyStatus: (id: string) => PropertyStatus
  focusPropertyId?: string | null
}

const GEOCACHE_KEY = 'rpm_geocache'

function loadGeoCache(): Record<string, { lat: number; lng: number } | null> {
  try {
    return JSON.parse(localStorage.getItem(GEOCACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveGeoCache(cache: Record<string, { lat: number; lng: number } | null>) {
  localStorage.setItem(GEOCACHE_KEY, JSON.stringify(cache))
}

function normalizeAddress(query: string): string {
  return query
    .replace(/,?\s*\d+[°º°]\s*(andar|floor|piso)[^,]*/gi, '')
    .replace(/,?\s*(apto?|apartamento|sala|bloco|loja|conj\.?|conjunto)[^,]*/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .trim()
}

async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const normalized = normalizeAddress(query)
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalized)}&limit=1`
  console.log('[Map] Geocoding:', normalized)
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
    console.warn('[Map] Não encontrado:', normalized)
    return null
  } catch (err) {
    console.error('[Map] Erro geocoding:', err)
    return null
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Offset markers that share the same coordinates into a small circle
function spreadCoords(
  items: { id: string; lat: number; lng: number }[]
): Record<string, { lat: number; lng: number }> {
  const result: Record<string, { lat: number; lng: number }> = {}
  const precision = 4 // ~11m grid
  const groups: Record<string, string[]> = {}

  for (const item of items) {
    const key = `${item.lat.toFixed(precision)},${item.lng.toFixed(precision)}`
    if (!groups[key]) groups[key] = []
    groups[key].push(item.id)
  }

  for (const item of items) {
    const key = `${item.lat.toFixed(precision)},${item.lng.toFixed(precision)}`
    const group = groups[key]
    if (group.length === 1) {
      result[item.id] = { lat: item.lat, lng: item.lng }
    } else {
      const idx = group.indexOf(item.id)
      const angle = (2 * Math.PI * idx) / group.length
      const offset = 0.00015 // ~17m
      result[item.id] = {
        lat: item.lat + offset * Math.cos(angle),
        lng: item.lng + offset * Math.sin(angle),
      }
    }
  }

  return result
}

function makeIcon(L: typeof import('leaflet'), color: string, focused: boolean) {
  const size = focused ? 22 : 14
  const border = focused ? 3 : 2
  const shadow = focused ? `0 0 0 4px ${color}44, 0 2px 6px rgba(0,0,0,0.5)` : '0 1px 4px rgba(0,0,0,0.4)'
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};border:${border}px solid white;border-radius:50%;
      width:${size}px;height:${size}px;
      box-shadow:${shadow};
      transition:all 0.2s;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function PropertyMapView({ properties, getPropertyStatus, focusPropertyId }: Props) {
  const { t } = useLanguage()
  const { formatCurrency } = useCurrency()
  const mapRef = useRef<LeafletMap | null>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const markerMapRef = useRef<Record<string, Marker>>({})
  const prevFocusRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [located, setLocated] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [hasMarkers, setHasMarkers] = useState(false)
  const LRef = useRef<typeof import('leaflet') | null>(null)
  const getStatusRef = useRef(getPropertyStatus)
  useEffect(() => { getStatusRef.current = getPropertyStatus })

  const handleFitAll = useCallback(() => {
    const L = LRef.current
    const map = mapRef.current
    const markers = Object.values(markerMapRef.current)
    if (!L || !map || markers.length === 0) return
    const group = L.featureGroup(markers)
    map.fitBounds(group.getBounds().pad(0.3), { animate: true })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      console.log('[Map] init(), properties:', properties.length)
      try {
        const L = (await import('leaflet')).default
        await import('leaflet/dist/leaflet.css')
        LRef.current = L

        delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })

        if (!mapDivRef.current || cancelled) return

        if (!mapRef.current) {
          mapRef.current = L.map(mapDivRef.current).setView([-15.793, -47.882], 5)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          }).addTo(mapRef.current)
        }

        Object.values(markerMapRef.current).forEach(m => m.remove())
        markerMapRef.current = {}

        const addressedProperties = properties.filter(p => p.address || p.city)
        setTotal(addressedProperties.length)

        if (addressedProperties.length === 0) {
          setLoading(false)
          return
        }

        const cache = loadGeoCache()
        const statusColor: Record<PropertyStatus, string> = {
          available: '#22c55e',
          occupied: '#f59e0b',
          maintenance: '#94a3b8',
        }
        const statusLabel: Record<PropertyStatus, string> = {
          available: t.properties_view.status.available,
          occupied: t.properties_view.status.occupied,
          maintenance: t.properties_view.status.maintenance,
        }

        // Geocode all properties first
        const coordsList: { id: string; lat: number; lng: number }[] = []

        for (let i = 0; i < addressedProperties.length; i++) {
          if (cancelled) return
          const p = addressedProperties[i]
          const query = [p.address, p.city].filter(Boolean).join(', ')
          const cacheKey = normalizeAddress(query).toLowerCase().trim()

          let coords = cache[cacheKey]
          if (!coords) {
            if (i > 0) await sleep(1100)
            coords = await geocodeAddress(query)
            if (coords) {
              cache[cacheKey] = coords
              saveGeoCache(cache)
            }
          }

          if (coords) coordsList.push({ id: p.id, ...coords })
        }

        if (cancelled || !mapRef.current) return

        // Spread overlapping markers
        const spreadPositions = spreadCoords(coordsList)
        const allMarkers: Marker[] = []

        for (const p of addressedProperties) {
          const pos = spreadPositions[p.id]
          if (!pos || !mapRef.current) continue

          const status = getStatusRef.current(p.id)
          const color = statusColor[status]
          const isFocused = p.id === focusPropertyId

          const address = [p.address, p.city].filter(Boolean).join(', ')
          const popup = `
            <div style="min-width:180px;font-family:sans-serif">
              <strong style="font-size:14px">${p.name}</strong>
              <div style="font-size:12px;color:#666;margin:2px 0">${address}</div>
              <div style="margin-top:6px">
                <span style="background:${color}22;color:${color};border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600">
                  ${statusLabel[status]}
                </span>
              </div>
              <div style="margin-top:6px;font-size:12px">
                ${p.pricePerMonth ? `<div>${t.properties_view.map.monthly}: <strong>${formatCurrency(p.pricePerMonth)}</strong></div>` : ''}
                ${p.pricePerNight ? `<div>${t.properties_view.map.nightly}: <strong>${formatCurrency(p.pricePerNight)}</strong></div>` : ''}
              </div>
            </div>
          `

          const marker = L.marker([pos.lat, pos.lng], { icon: makeIcon(L, color, isFocused) })
            .addTo(mapRef.current!)
            .bindPopup(popup)

          markerMapRef.current[p.id] = marker
          allMarkers.push(marker)
          setLocated(prev => prev + 1)
        }

        if (cancelled || !mapRef.current) return

        const focusMarker = focusPropertyId ? markerMapRef.current[focusPropertyId] : null
        if (focusMarker) {
          mapRef.current.setView(focusMarker.getLatLng(), 16, { animate: false })
          setTimeout(() => focusMarker.openPopup(), 300)
        } else if (allMarkers.length > 0) {
          const group = L.featureGroup(allMarkers)
          mapRef.current.fitBounds(group.getBounds().pad(0.3))
        }

        setHasMarkers(allMarkers.length > 0)
        setLoading(false)
      } catch (err) {
        console.error('[Map] Erro:', err)
        setError(String(err))
        setLoading(false)
      }
    }

    setLoading(true)
    setLocated(0)
    setError(null)
    init()

    return () => { cancelled = true }
  }, [properties])

  // Focus when user clicks "Mostrar no mapa" while already on map view
  useEffect(() => {
    if (loading || !LRef.current || !focusPropertyId) return
    const L = LRef.current
    const statusColor: Record<PropertyStatus, string> = {
      available: '#22c55e',
      occupied: '#f59e0b',
      maintenance: '#94a3b8',
    }

    // Reset previous marker
    if (prevFocusRef.current && prevFocusRef.current !== focusPropertyId) {
      const prev = markerMapRef.current[prevFocusRef.current]
      const prop = properties.find(p => p.id === prevFocusRef.current)
      if (prev && prop) prev.setIcon(makeIcon(L, statusColor[getStatusRef.current(prop.id)], false))
    }

    const marker = markerMapRef.current[focusPropertyId]
    const prop = properties.find(p => p.id === focusPropertyId)
    console.log('[Map] focus effect — marker:', !!marker, 'prop:', !!prop, 'id:', focusPropertyId)
    if (marker && mapRef.current && prop) {
      marker.setIcon(makeIcon(L, statusColor[getStatusRef.current(prop.id)], true))
      mapRef.current.setView(marker.getLatLng(), 16, { animate: true })
      setTimeout(() => marker.openPopup(), 400)
      prevFocusRef.current = focusPropertyId
    }
  }, [focusPropertyId])

  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  const noAddress = properties.every(p => !p.address && !p.city)

  return (
    <div style={{ isolation: 'isolate', height: 520 }} className="relative rounded-lg overflow-hidden border bg-card">
      {loading && total > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] bg-background/90 border rounded-full px-4 py-1.5 text-sm shadow">
          {`${t.properties_view.map.locating} ${located}/${total}`}
        </div>
      )}
      {!loading && noAddress && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/80">
          <p className="text-muted-foreground text-sm">
            {t.properties_view.map.no_address}
          </p>
        </div>
      )}
      {error && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] bg-destructive/10 border border-destructive rounded px-4 py-1.5 text-sm text-destructive">
          Erro: {error}
        </div>
      )}
      {!loading && hasMarkers && (
        <button
          onClick={handleFitAll}
          title={t.properties_view.map.view_all_title}
          style={{ zIndex: 1000 }}
          className="absolute bottom-6 right-3 bg-background border rounded-lg shadow px-3 py-2 text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 256 256" fill="currentColor">
            <path d="M213.66,42.34a8,8,0,0,0-7.84-2l-176,48A8,8,0,0,0,28.8,99.6L96,128l28.4,67.2a8,8,0,0,0,7.4,5c.27,0,.54,0,.81,0a8,8,0,0,0,7.3-5.31l48-176A8,8,0,0,0,213.66,42.34Z"/>
          </svg>
          {t.properties_view.map.view_all}
        </button>
      )}
      <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
