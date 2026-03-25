import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet'
import { Navigation } from 'lucide-react'
import type { PlanningSlot } from '../../../../types'
import { clientDisplayName, formatTime } from '../../utils/date-helpers'
import 'leaflet/dist/leaflet.css'

const ZONE_MAP_COLORS: Record<string, string> = {
  zone_1: '#3b82f6',
  zone_2: '#22c55e',
  zone_3: '#f59e0b',
  zone_4: '#ef4444',
  zone_5: '#a855f7',
}

const TOURS_CENTER: [number, number] = [47.39, 0.69]

// ---------------------------------------------------------------------------
// Nearest-neighbor TSP heuristic
// ---------------------------------------------------------------------------
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const sin2Lat = Math.sin(dLat / 2) ** 2
  const sin2Lon = Math.sin(dLon / 2) ** 2
  const h = sin2Lat + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * sin2Lon
  return 2 * R * Math.asin(Math.sqrt(h))
}

function nearestNeighbor(points: [number, number][], start: [number, number]): number[] {
  const n = points.length
  const visited = new Set<number>()
  const order: number[] = []
  let current = start

  while (order.length < n) {
    let nearest = -1
    let minDist = Infinity
    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue
      const d = haversineKm(current, points[i])
      if (d < minDist) { minDist = d; nearest = i }
    }
    if (nearest === -1) break
    order.push(nearest)
    visited.add(nearest)
    current = points[nearest]
  }
  return order
}

// Auto-fit bounds helper
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useMemo(() => {
    if (positions.length === 0) return
    const lats = positions.map(p => p[0])
    const lngs = positions.map(p => p[1])
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
      [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01],
    ]
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, positions])
  return null
}

interface ZoneMapProps {
  slots: PlanningSlot[]
  date: string
}

export function ZoneMap({ slots, date }: ZoneMapProps) {
  const [optimized, setOptimized] = useState(false)

  const daySlots = useMemo(
    () => slots.filter((s) => s.slot_date === date && s.chantier?.latitude && s.chantier?.longitude),
    [slots, date],
  )

  const positions: [number, number][] = useMemo(
    () => daySlots.map(s => [s.chantier!.latitude!, s.chantier!.longitude!]),
    [daySlots],
  )

  // Route order — natural or optimized
  const routeOrder = useMemo(() => {
    if (!optimized || positions.length < 2) return positions.map((_, i) => i)
    return nearestNeighbor(positions, TOURS_CENTER)
  }, [optimized, positions])

  const routePositions: [number, number][] = useMemo(
    () => routeOrder.map(i => positions[i]),
    [routeOrder, positions],
  )

  const totalKm = useMemo(() => {
    if (routePositions.length < 2) return 0
    let d = haversineKm(TOURS_CENTER, routePositions[0])
    for (let i = 0; i < routePositions.length - 1; i++) {
      d += haversineKm(routePositions[i], routePositions[i + 1])
    }
    return Math.round(d)
  }, [routePositions])

  if (daySlots.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-400">
        Aucune intervention géolocalisée
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-white border-b border-slate-100 shrink-0">
        <button
          onClick={() => setOptimized(o => !o)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            optimized
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          {optimized ? 'Itinéraire optimisé' : 'Optimiser l\'itinéraire'}
        </button>
        {optimized && totalKm > 0 && (
          <span className="text-xs text-slate-500">
            ≈ {totalKm} km estimés · {daySlots.length} arrêt{daySlots.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <MapContainer
          center={TOURS_CENTER}
          zoom={10}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {positions.length > 0 && <FitBounds positions={positions} />}

          {/* Route polyline when optimized */}
          {optimized && routePositions.length > 1 && (
            <Polyline
              positions={[TOURS_CENTER, ...routePositions]}
              pathOptions={{ color: '#7AB928', weight: 2.5, dashArray: '6 4', opacity: 0.8 }}
            />
          )}

          {/* Markers */}
          {routeOrder.map((slotIdx, order) => {
            const slot = daySlots[slotIdx]
            const lat = slot.chantier!.latitude!
            const lng = slot.chantier!.longitude!
            const zone = slot.chantier!.geographic_zone
            const color = zone ? ZONE_MAP_COLORS[zone] ?? '#6366f1' : '#6366f1'
            const client = slot.chantier?.client
            const label = optimized ? String(order + 1) : undefined

            return (
              <CircleMarker
                key={slot.id}
                center={[lat, lng]}
                radius={optimized ? 12 : 8}
                pathOptions={{ color: optimized ? '#7AB928' : color, fillColor: optimized ? '#7AB928' : color, fillOpacity: 0.85, weight: 2 }}
              >
                <Popup>
                  <div className="text-xs min-w-[120px]">
                    {optimized && (
                      <p className="font-bold text-primary-700 mb-1">Arrêt #{order + 1}</p>
                    )}
                    <p className="font-semibold">{clientDisplayName(client)}</p>
                    <p className="text-slate-500">{slot.team?.name ?? '—'}</p>
                    <p className="text-slate-400">{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
                    {slot.chantier?.address_line1 && (
                      <p className="text-slate-400 mt-0.5">{slot.chantier.address_line1}</p>
                    )}
                  </div>
                </Popup>

                {/* Order label overlay — via SVG on CircleMarker is not native, use tooltip trick */}
                {label && (
                  // We render the label via a hidden tooltip that shows always
                  // Actually Leaflet CircleMarker doesn't support permanent labels natively without DivIcon
                  // We'll skip it — the popup + color is sufficient
                  null
                )}
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
