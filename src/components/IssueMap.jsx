import { useEffect, useMemo, useRef, useState } from 'react'
import { doc, increment, runTransaction } from 'firebase/firestore'
import { db } from '../lib/firebase'

const L = window.L
if (L?.Icon?.Default) {
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

const SEVERITY_COLORS = { Critical: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' }

const markerHtml = (color) => `<div class="issue-pin" style="--marker:${color}"></div>`
const hotZoneHtml = (count) => `<div class="hot-zone">🔥 Hot Zone <span>${count}</span></div>`

function MapContainer({ validIssues, hotZones, onSelectIssue, focusIssueId }) {
  const mapRef = useRef(null)
  const mapNodeRef = useRef(null)
  const markersLayerRef = useRef(null)

  useEffect(() => {
    if (!mapNodeRef.current || !window.L || mapRef.current) return

    const map = window.L.map(mapNodeRef.current, { zoomControl: false }).setView([41.8358, -87.6277], 13)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => map.setView([coords.latitude, coords.longitude], 13),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }

    window.L.control.zoom({ position: 'bottomright' }).addTo(map)
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    markersLayerRef.current = window.L.layerGroup().addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 0)

    return () => map.remove()
  }, [])

  useEffect(() => {
    if (!mapRef.current || !validIssues.length || !window.L) return
    const bounds = window.L.latLngBounds(validIssues.map((issue) => [issue.location.lat, issue.location.lng]))
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
  }, [validIssues])

  useEffect(() => {
    if (!mapRef.current || !focusIssueId) return
    const focusedIssue = validIssues.find((issue) => issue.id === focusIssueId)
    if (!focusedIssue) return
    mapRef.current.flyTo([focusedIssue.location.lat, focusedIssue.location.lng], 16, { duration: 0.6 })
  }, [focusIssueId, validIssues])

  useEffect(() => {
    if (!markersLayerRef.current || !window.L) return

    const layer = markersLayerRef.current
    layer.clearLayers()

    validIssues.forEach((issue) => {
      const color = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.Medium
      const marker = window.L.marker([issue.location.lat, issue.location.lng], {
        icon: window.L.divIcon({ html: markerHtml(color), className: 'marker-shell', iconSize: [26, 26] }),
      })

      marker.on('click', () => onSelectIssue(issue.id))
      marker.addTo(layer)
    })

    hotZones.forEach((zone) => {
      window.L.marker([zone.lat, zone.lng], {
        icon: window.L.divIcon({ html: hotZoneHtml(zone.issues.length), className: 'hot-zone-shell', iconSize: [140, 42] }),
      }).addTo(layer)
    })
  }, [validIssues, hotZones, onSelectIssue])

  return <div ref={mapNodeRef} style={{ height: '100%', width: '100%' }} />
}

function IssueMap({ issues, selectedIssue, onSelectIssue, onCloseIssue, focusIssueId }) {
  const containerRef = useRef(null)
  const [isContainerReady, setIsContainerReady] = useState(false)
  const [optimisticVotes, setOptimisticVotes] = useState({})

  const validIssues = useMemo(
    () => issues.filter((issue) => typeof issue.location?.lat === 'number' && typeof issue.location?.lng === 'number'),
    [issues]
  )

  const hotZones = useMemo(() => {
    const groups = validIssues.reduce((acc, issue) => {
      const key = `${issue.location.lat.toFixed(3)}:${issue.location.lng.toFixed(3)}`
      const group = acc.get(key) || { lat: issue.location.lat, lng: issue.location.lng, issues: [] }
      group.issues.push(issue)
      acc.set(key, group)
      return acc
    }, new Map())

    return [...groups.values()].filter((zone) => zone.issues.length >= 3)
  }, [validIssues])

  useEffect(() => {
    if (containerRef.current) {
      setIsContainerReady(true)
    }
  }, [])

  const upvote = async (issue) => {
    setOptimisticVotes((prev) => ({ ...prev, [issue.id]: (prev[issue.id] ?? issue.upvotes ?? 0) + 1 }))

    const ref = doc(db, 'reports', issue.id)
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        if (!snap.exists()) return
        const current = snap.data()
        const nextVotes = (current.upvotes || 0) + 1

        transaction.update(ref, {
          upvotes: increment(1),
          status: nextVotes >= 10 ? 'Escalated' : current.status || 'Open',
        })
      })
    } catch (error) {
      console.error('Upvote failed', error)
      setOptimisticVotes((prev) => ({ ...prev, [issue.id]: issue.upvotes || 0 }))
    }
  }

  const issue = selectedIssue

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#22C55E]/20 bg-[#0D1F0F]">
      <div ref={containerRef} style={{ height: '500px', width: '100%' }}>
        {isContainerReady ? (
          <MapContainer
            key="map"
            validIssues={validIssues}
            hotZones={hotZones}
            onSelectIssue={onSelectIssue}
            focusIssueId={focusIssueId}
          />
        ) : null}
      </div>

      <aside
        className={`glass-card fixed right-0 top-0 z-[100] h-screen w-full max-w-[420px] overflow-y-auto border-l border-[#22C55E]/25 p-5 transition-transform duration-300 md:w-[420px] ${
          issue ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {issue && (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">Issue details</h3>
              <button type="button" onClick={onCloseIssue} className="text-civic-mist/70 transition hover:text-civic-mist">✕</button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#22C55E]/25 bg-[#132918]">
              {issue.photo_base64 || issue.photo_url ? (
                <img src={issue.photo_base64 || issue.photo_url} alt={issue.category} className="h-44 w-full object-cover" />
              ) : (
                <div className="grid h-44 place-items-center bg-[#132918] text-sm text-civic-mist/70">No image available</div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-full border border-[#22C55E]/30 bg-[#132918] px-2 py-1 text-xs">{issue.category}</span>
              <span className="rounded-full px-2 py-1 text-xs" style={{ background: `${SEVERITY_COLORS[issue.severity]}33`, color: SEVERITY_COLORS[issue.severity] }}>
                {issue.severity}
              </span>
              <span className="rounded-full border border-red-400/40 bg-red-500/20 px-2 py-1 text-xs text-red-100">
                {String(issue.status).toLowerCase() === 'escalated' ? '🔥 Escalated' : issue.status || 'Open'}
              </span>
            </div>

            <p className="mt-3 text-sm text-civic-mist/90">{issue.description}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-civic-mist/60">AI analysis</p>
            <p className="mt-1 text-sm text-civic-mist/80">{issue.ai_analysis || 'Assessment generated from user report and image context.'}</p>

            <button
              type="button"
              onClick={() => upvote(issue)}
              className="mt-4 w-full rounded-xl bg-civic-electric px-3 py-2 text-sm font-semibold shadow-glow"
            >
              ⬆ Upvote ({optimisticVotes[issue.id] ?? issue.upvotes ?? 0})
            </button>

            <div className="mt-4 rounded-2xl border border-[#22C55E]/20 bg-[#132918] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-civic-mist/60">Status tracker</p>
              <p className="mt-1 text-sm text-civic-mist/90">Current stage: {issue.status || 'Open'} {String(issue.status).toLowerCase() === 'escalated' ? '🔥' : ''}</p>
            </div>

            <div className="mt-3 rounded-2xl border border-[#22C55E]/20 bg-[#132918] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-civic-mist/60">Auto-generated complaint letter</p>
              <p className="mt-1 whitespace-pre-line text-sm text-civic-mist/80">{issue.ai_letter || 'No letter available yet.'}</p>
            </div>

            <p className="mt-3 text-xs text-civic-mist/60">
              Reported:{' '}
              {issue.timestamp?.toDate?.()
                ? issue.timestamp.toDate().toLocaleString()
                : 'Timestamp unavailable'}
            </p>
          </>
        )}
      </aside>
    </section>
  )
}

export default IssueMap
