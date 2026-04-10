import { useEffect, useMemo, useRef, useState } from 'react'
import { doc, increment, runTransaction } from 'firebase/firestore'
import { db } from '../lib/firebase'

const SEVERITY_COLORS = { Critical: '#ef4444', Medium: '#f97316', Low: '#22c55e' }

const markerHtml = (color) => `<div class="issue-pin" style="--marker:${color}"></div>`
const hotZoneHtml = (count) => `<div class="hot-zone">🔥 Hot Zone <span>${count}</span></div>`

function IssueMap({ issues, selectedIssue, onSelectIssue }) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const markersLayerRef = useRef(null)
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
    if (!containerRef.current || !window.L || mapRef.current) return

    const map = window.L.map(containerRef.current, { zoomControl: false }).setView([40.7128, -74.006], 12)
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
    if (!mapRef.current) return
    mapRef.current.invalidateSize()
  }, [validIssues.length])

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
    <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-[#070d1a]">
      <div ref={containerRef} className="h-[500px] w-full" />

      {issue && (
        <aside className="glass-card absolute right-4 top-4 z-[500] max-h-[calc(100%-2rem)] w-[360px] overflow-y-auto rounded-3xl p-4">
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/30">
            {issue.photo_base64 ? (
              <img src={issue.photo_base64} alt={issue.category} className="h-44 w-full object-cover" />
            ) : (
              <div className="grid h-44 place-items-center text-sm text-white/50">No image</div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs">{issue.category}</span>
            <span className="rounded-full px-2 py-1 text-xs" style={{ background: `${SEVERITY_COLORS[issue.severity]}33`, color: SEVERITY_COLORS[issue.severity] }}>
              {issue.severity}
            </span>
            <span className="rounded-full border border-red-400/40 bg-red-500/20 px-2 py-1 text-xs text-red-100">
              {String(issue.status).toLowerCase() === 'escalated' ? '🔥 Escalated' : issue.status || 'Open'}
            </span>
          </div>

          <p className="mt-3 text-sm text-white/85">{issue.description}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/45">AI analysis</p>
          <p className="mt-1 text-sm text-white/75">{issue.ai_analysis || 'Assessment generated from user report and image context.'}</p>

          <button
            type="button"
            onClick={() => upvote(issue)}
            className="mt-4 w-full rounded-xl bg-civic-electric px-3 py-2 text-sm font-semibold shadow-glow"
          >
            ⬆ Upvote ({optimisticVotes[issue.id] ?? issue.upvotes ?? 0})
          </button>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Status tracker</p>
            <p className="mt-1 text-sm text-white/85">Current stage: {issue.status || 'Open'} {String(issue.status).toLowerCase() === 'escalated' ? '🔥' : ''}</p>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Auto-generated complaint letter</p>
            <p className="mt-1 whitespace-pre-line text-sm text-white/75">{issue.ai_letter || 'No letter available yet.'}</p>
          </div>
        </aside>
      )}
    </section>
  )
}

export default IssueMap
