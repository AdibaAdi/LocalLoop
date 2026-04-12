import { useEffect, useMemo, useState } from 'react'
import { Timestamp, collection, doc, getDocs, limit, onSnapshot, query, setDoc, updateDoc } from 'firebase/firestore'
import Navbar from '../components/Navbar'
import ReportIssueModal from '../components/ReportIssueModal'
import IssueMap from '../components/IssueMap'
import { db } from '../lib/firebase'

const FILTERS = {
  category: ['All', 'Pothole', 'Flooding', 'Broken Light', 'Graffiti', 'Safety Hazard', 'Other'],
  severity: ['All', 'Critical', 'Medium', 'Low'],
  status: ['All', 'Open', 'Escalated', 'Resolved'],
}

const CATEGORY_NORMALIZATION = {
  pothole: 'Pothole',
  flooding: 'Flooding',
  'broken light': 'Broken Light',
  'broken-light': 'Broken Light',
  graffiti: 'Graffiti',
  'safety hazard': 'Safety Hazard',
  'safety-hazard': 'Safety Hazard',
  other: 'Other',
}

const normalizeCategory = (category) => {
  if (!category) return 'Other'
  const key = String(category).trim().toLowerCase()
  return CATEGORY_NORMALIZATION[key] || category
}

const normalizeSeverity = (severity) => {
  if (!severity) return 'Low'
  const value = String(severity).trim().toLowerCase()
  if (value === 'critical') return 'Critical'
  if (value === 'medium') return 'Medium'
  return 'Low'
}

const statusNorm = (status) => {
  if (!status) return 'Open'
  const value = String(status).toLowerCase()
  if (value === 'resolved') return 'Resolved'
  if (value === 'escalated') return 'Escalated'
  return 'Open'
}

const SEVERITY_STYLES = {
  Critical: 'bg-red-500/20 text-red-100 border border-red-400/40',
  Medium: 'bg-amber-500/20 text-amber-100 border border-amber-300/40',
  Low: 'bg-emerald-500/20 text-emerald-100 border border-emerald-300/40',
}

const toMillis = (issue) => {
  const stamp = issue.timestamp?.toDate?.() || issue.updatedAt?.toDate?.()
  return stamp?.getTime?.() || 0
}

const timeAgo = (issue) => {
  const timestamp = toMillis(issue)
  if (!timestamp) return 'Unknown time'
  const diff = Math.max(0, Date.now() - timestamp)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  return `${Math.floor(diff / day)}d ago`
}


const CHICAGO_IIT_COORDS = [
  { lat: 41.83496, lng: -87.62712, address: '3410 S State St, Chicago, IL 60616' },
  { lat: 41.83718, lng: -87.62588, address: '3140 S Wabash Ave, Chicago, IL 60616' },
  { lat: 41.83614, lng: -87.62882, address: '3200 S Dearborn St, Chicago, IL 60616' },
  { lat: 41.83396, lng: -87.62991, address: '3344 S Federal St, Chicago, IL 60616' },
  { lat: 41.83154, lng: -87.62389, address: '3500 S Michigan Ave, Chicago, IL 60653' },
]

const EMERGENCY_CONTACTS = [
  { icon: '🚔', name: 'Police/Fire/Medical', detail: '911', href: 'tel:911' },
  { icon: '🏙️', name: 'Chicago 311 (non-emergency city services)', detail: '311', href: 'tel:311' },
  { icon: '🚧', name: 'CDOT Emergency', detail: '(312) 744-5000', href: 'tel:+13127445000' },
  { icon: '💧', name: 'Water Emergency', detail: '(312) 744-7038', href: 'tel:+13127447038' },
  { icon: '⚡', name: 'ComEd Outage', detail: '1-800-334-7661', href: 'tel:+18003347661' },
]

const extractNeighborhood = (address = '') => {
  if (!address) return 'Unknown area'
  const parts = String(address).split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return parts[1]
  }

  return parts[0] || 'Unknown area'
}

const isLegacyNycSeed = (location = {}) => {
  const address = String(location.address || '').toLowerCase()
  const lat = Number(location.lat)
  const lng = Number(location.lng)

  if (address.includes('new york') || address.includes('manhattan')) return true
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return lat > 40.6 && lat < 40.95 && lng > -74.1 && lng < -73.7
  }

  return false
}

function DashboardPage({ navigate, autoOpenReport, user }) {
  const [issues, setIssues] = useState([])
  const [selectedIssueId, setSelectedIssueId] = useState('')
  const [mapFocusRequest, setMapFocusRequest] = useState({ issueId: '', nonce: 0 })
  const [reportOpen, setReportOpen] = useState(autoOpenReport)
  const [filters, setFilters] = useState({ category: 'All', severity: 'All', status: 'All' })
  const [locationQuery, setLocationQuery] = useState('')
  const [nearMeLoading, setNearMeLoading] = useState(false)
  const [activePanel, setActivePanel] = useState(null)
  const [emergencyOpen, setEmergencyOpen] = useState(false)

  useEffect(() => {
    setReportOpen(autoOpenReport)
  }, [autoOpenReport])

  useEffect(() => {
    const seedReports = async () => {
      const reportsRef = collection(db, 'reports')
      const existing = await getDocs(query(reportsRef, limit(3)))

      const seedData = [
        {
          category: 'Pothole',
          severity: 'Critical',
          description: 'Deep pothole in the right lane causing sudden swerves near morning campus traffic.',
          ai_analysis: 'Severe pavement failure along a high-use commuter corridor near campus.',
          ai_letter:
            'Dear Chicago Department of Transportation,\nA severe pothole on South State Street near IIT is forcing vehicles to swerve unexpectedly. Please prioritize immediate patching to prevent crashes and further road damage.\nSincerely,\nA concerned resident.',
          upvotes: 18,
          status: 'Open',
          location: { lat: 41.83496, lng: -87.62712, address: '3410 S State St, Chicago, IL 60616' },
          photo_url: 'https://picsum.photos/seed/1/400/300',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
        },
        {
          category: 'Flooding',
          severity: 'Medium',
          description: 'Stormwater pooling blocks curb ramp after rain near student housing entrance.',
          ai_analysis: 'Recurring drainage obstruction affecting pedestrian and wheelchair access.',
          ai_letter:
            'Dear Streets and Sanitation Department,\nPersistent flooding at the curb ramp near South Wabash Avenue is limiting safe pedestrian access after rainfall. Please inspect nearby drains and schedule cleaning.\nThank you.',
          upvotes: 12,
          status: 'Open',
          location: { lat: 41.83718, lng: -87.62588, address: '3140 S Wabash Ave, Chicago, IL 60616' },
          photo_url: 'https://picsum.photos/seed/2/400/300',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
        },
        {
          category: 'Broken Light',
          severity: 'Critical',
          description: 'Crosswalk signal not illuminating at night at busy pedestrian crossing.',
          ai_analysis: 'Electrical outage for crossing control at high-footfall intersection.',
          ai_letter:
            'Dear Chicago Department of Transportation,\nThe pedestrian crossing signal at South Dearborn Street is not functioning at night, creating a major safety risk. Please dispatch an electrical crew urgently.\nRegards.',
          upvotes: 20,
          status: 'Escalated',
          location: { lat: 41.83614, lng: -87.62882, address: '3200 S Dearborn St, Chicago, IL 60616' },
          photo_url: 'https://picsum.photos/seed/3/400/300',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
        },
        {
          category: 'Graffiti',
          severity: 'Low',
          description: 'Fresh graffiti tags on retaining wall visible from main sidewalk.',
          ai_analysis: 'Non-urgent but recurring vandalism requiring cleanup and monitoring.',
          ai_letter:
            'Dear Graffiti Blasters Team,\nThere is new graffiti on the retaining wall along South Federal Street near IIT. Please schedule removal to keep the corridor clean and welcoming.\nBest regards.',
          upvotes: 7,
          status: 'Resolved',
          location: { lat: 41.83396, lng: -87.62991, address: '3344 S Federal St, Chicago, IL 60616' },
          photo_url: 'https://picsum.photos/seed/4/400/300',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
        },
        {
          category: 'Safety Hazard',
          severity: 'Medium',
          description: 'Exposed metal plate on sidewalk near bus stop creates tripping hazard.',
          ai_analysis: 'Pedestrian trip hazard adjacent to transit stop; moderate injury risk.',
          ai_letter:
            'Dear CDOT Sidewalk Maintenance,\nAn exposed metal plate on the sidewalk at South Michigan Avenue near 35th Street is creating a tripping risk for pedestrians. Please secure and repair this section promptly.\nSincerely.',
          upvotes: 9,
          status: 'Open',
          location: { lat: 41.83154, lng: -87.62389, address: '3500 S Michigan Ave, Chicago, IL 60653' },
          photo_url: 'https://picsum.photos/seed/5/400/300',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)),
        },
      ]

      if (existing.size < 3) {
        await Promise.all(
          seedData.map(async (report) => {
            const ref = doc(reportsRef)
            await setDoc(ref, { id: ref.id, photo_base64: '', photo_url: report.photo_url || '', ...report })
          })
        )
      }

      const allReports = await getDocs(query(reportsRef))
      await Promise.all(
        allReports.docs
          .filter((docSnap) => {
            const data = docSnap.data()
            return !data.photo_base64 && !data.photo_url
          })
          .map((docSnap, index) =>
            updateDoc(doc(db, 'reports', docSnap.id), {
              photo_url: `https://picsum.photos/seed/backfill-${index + 1}/400/300`,
            })
          )
      )

      await Promise.all(
        allReports.docs
          .filter((docSnap) => isLegacyNycSeed(docSnap.data().location))
          .map((docSnap, index) => {
            const chicagoPoint = CHICAGO_IIT_COORDS[index % CHICAGO_IIT_COORDS.length]
            return updateDoc(doc(db, 'reports', docSnap.id), {
              location: chicagoPoint,
            })
          })
      )
    }

    seedReports().catch((error) => {
      console.error('Failed to seed demo reports', error)
    })
  }, [])

  useEffect(() => {
    const reportsQuery = query(collection(db, 'reports'))
    const unsub = onSnapshot(reportsQuery, (snapshot) => {
      const next = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      setIssues(next)
    })

    return () => unsub()
  }, [])

  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        const categoryPass = filters.category === 'All' || normalizeCategory(issue.category) === filters.category
        const severityPass = filters.severity === 'All' || normalizeSeverity(issue.severity) === filters.severity
        const statusPass = filters.status === 'All' || statusNorm(issue.status) === filters.status
        const normalizedAddress = String(issue.location?.address || '').toLowerCase()
        const normalizedLocationQuery = locationQuery.trim().toLowerCase()
        const locationPass = !normalizedLocationQuery || normalizedAddress.includes(normalizedLocationQuery)
        return categoryPass && severityPass && statusPass && locationPass
      }),
    [issues, filters, locationQuery]
  )

  const selectedIssue = useMemo(
    () => filteredIssues.find((issue) => issue.id === selectedIssueId) || null,
    [filteredIssues, selectedIssueId]
  )

  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000

    const openTotal = issues.filter((item) => String(item.status || '').toLowerCase() === 'open').length
    const resolvedThisWeek = issues.filter((item) => {
      const stamp = item.timestamp?.toDate?.() || item.updatedAt?.toDate?.()
      return String(item.status || '').toLowerCase() === 'resolved' && stamp && stamp.getTime() >= weekAgo
    }).length

    const neighborhoodCounts = issues.reduce((acc, issue) => {
      const key = extractNeighborhood(issue.location?.address)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const [topNeighborhood = 'Unknown area'] = Object.entries(neighborhoodCounts).sort((a, b) => b[1] - a[1])[0] || []

    const topUrgent = [...filteredIssues]
      .filter((issue) => {
        const stamp = issue.timestamp?.toDate?.()
        return !stamp || stamp.getTime() >= weekAgo
      })
      .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
      .slice(0, 5)

    return { openTotal, resolvedThisWeek, topNeighborhood, topUrgent }
  }, [issues, filteredIssues])

  const openIssues = useMemo(
    () => issues.filter((item) => String(item.status || '').toLowerCase() === 'open'),
    [issues]
  )

  const resolvedIssuesThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return issues
      .filter(
        (item) =>
          String(item.status || '').toLowerCase() === 'resolved' &&
          toMillis(item) >= weekAgo
      )
      .sort((a, b) => toMillis(b) - toMillis(a))
  }, [issues])

  const topNeighborhoods = useMemo(() => {
    const counts = issues.reduce((acc, issue) => {
      const key = extractNeighborhood(issue.location?.address)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [issues])

  const handleNearMe = async () => {
    if (!navigator.geolocation || nearMeLoading) return
    setNearMeLoading(true)

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const lat = Number(coords.latitude.toFixed(6))
        const lng = Number(coords.longitude.toFixed(6))

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
          )
          const data = await response.json()
          const detectedArea =
            data?.address?.neighbourhood ||
            data?.address?.suburb ||
            data?.address?.quarter ||
            data?.address?.postcode ||
            data?.address?.city_district ||
            ''
          setLocationQuery(String(detectedArea || data?.display_name || '').trim())
        } catch {
          setLocationQuery('')
        } finally {
          setNearMeLoading(false)
        }
      },
      () => {
        setLocationQuery('')
        setNearMeLoading(false)
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  const focusIssueOnMap = (issueId, closePanel = false) => {
    setSelectedIssueId(issueId)
    setMapFocusRequest((prev) => ({ issueId, nonce: prev.nonce + 1 }))
    if (closePanel) {
      setActivePanel(null)
    }
  }

  return (
    <main className="min-h-screen bg-civic-night text-white">
      <Navbar user={user} navigate={navigate} />

      <section className="mx-auto max-w-[1400px] px-5 pb-8 pt-5">
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <StatCard
            icon="📂"
            label="Open Issues"
            value={stats.openTotal}
            onClick={() => {
              setSelectedIssueId('')
              setActivePanel('open')
            }}
            accent="green"
          />
          <StatCard
            icon="✅"
            label="Resolved This Week"
            value={stats.resolvedThisWeek}
            onClick={() => {
              setSelectedIssueId('')
              setActivePanel('resolved')
            }}
          />
          <StatCard
            icon="📍"
            label="Most Affected Neighborhood"
            value={stats.topNeighborhood}
            onClick={() => {
              setSelectedIssueId('')
              setActivePanel('neighborhoods')
            }}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
                placeholder="Search neighborhood or zip code..."
                className="w-full max-w-md rounded-xl border border-[#2D4A2D] bg-[#1A2E1A] px-3 py-2 text-sm text-[#D1D5DB] outline-none transition focus:border-civic-electric"
              />
              <button
                type="button"
                onClick={handleNearMe}
                disabled={nearMeLoading}
                className="rounded-full border border-[#2D4A2D] bg-[#1A2E1A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1E351E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {nearMeLoading ? 'Locating…' : '📍 Near me'}
              </button>
              {locationQuery.trim() ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-civic-electric/40 bg-civic-electric/15 px-3 py-1 text-xs text-[#D1D5DB]">
                  Showing: {locationQuery.trim()}
                  <button
                    type="button"
                    onClick={() => setLocationQuery('')}
                    className="text-civic-mist/80 transition hover:text-white"
                    aria-label="Clear location filter"
                  >
                    ×
                  </button>
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(FILTERS).map(([key, values]) => (
                <FilterGroup
                  key={key}
                  label={key}
                  values={values}
                  current={filters[key]}
                  onChange={(value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="rounded-full bg-civic-electric px-5 py-2 text-sm font-semibold shadow-glow transition hover:brightness-110"
          >
            + Report an Issue
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <IssueMap
            issues={filteredIssues}
            selectedIssue={selectedIssue}
            onSelectIssue={(id) => setSelectedIssueId(id)}
            onCloseIssue={() => setSelectedIssueId('')}
            focusRequest={mapFocusRequest}
          />

          <aside className="rounded-3xl border border-[#2D4A2D] bg-[#162316] p-4">
            <h3 className="text-sm uppercase tracking-[0.2em] text-white">Top 5 Most Urgent Issues This Week</h3>
            <ul className="mt-4 space-y-2">
              {stats.topUrgent.map((issue, index) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    onClick={() => focusIssueOnMap(issue.id)}
                    className="w-full rounded-2xl border-l-4 border-l-[#22C55E] border-r border-t border-b border-[#2D4A2D] bg-[#162316] p-3 text-left transition hover:bg-[#1E351E]"
                  >
                  <p className="text-xs text-white">#{index + 1} · {issue.category}</p>
                  <p className="mt-1 text-sm text-[#D1D5DB]">{issue.description || 'No description provided'}</p>
                  <p className="mt-1 text-xs font-semibold text-[#22C55E]">⬆ {issue.upvotes || 0} upvotes</p>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <ReportIssueModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmitSuccess={() => {
          setReportOpen(false)
          navigate('/dashboard')
        }}
      />

      <button
        type="button"
        onClick={() => setEmergencyOpen(true)}
        className="emergency-button fixed bottom-6 right-6 z-[110] rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(239,68,68,0.65)] transition hover:bg-red-500 animate-pulse"
        style={{ zIndex: 100000, position: 'fixed' }}
      >
        🚨 Emergency?
      </button>

      {emergencyOpen ? (
        <div className="emergency-modal-overlay fixed inset-0 z-[140] flex items-center justify-center bg-black/65 px-4" style={{ zIndex: 100000, position: 'fixed' }}>
          <div className="w-full max-w-2xl rounded-3xl border border-red-400/35 bg-[#0B170C] p-5 text-[#D1D5DB] shadow-[0_0_40px_rgba(239,68,68,0.35)] md:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white md:text-2xl">🚨 Is this an emergency?</h2>
                <p className="mt-2 text-sm text-[#D1D5DB]">
                  LocalLoop is for non-emergency reporting. For immediate dangers, contact:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEmergencyOpen(false)}
                className="rounded-full border border-civic-mist/20 px-3 py-1 text-sm text-civic-mist/80 transition hover:border-civic-mist/45 hover:text-white"
                aria-label="Close emergency contacts modal"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3">
              {EMERGENCY_CONTACTS.map((contact) => (
                <a
                  key={contact.name}
                  href={contact.href}
                  className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 transition hover:bg-red-500/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {contact.icon} {contact.name}
                      </p>
                      <p className="mt-1 text-sm text-[#D1D5DB]">{contact.detail}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                      Call now
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <p className="mt-5 text-sm text-[#D1D5DB]">Not an emergency? Close this and submit your report below 👇</p>
          </div>
        </div>
      ) : null}

      <aside
        className={`fixed right-0 top-0 z-[120] h-screen w-full max-w-[440px] overflow-y-auto border-l border-[#22C55E]/25 bg-[#0B170C]/95 p-5 backdrop-blur-md transition-transform duration-300 ${
          activePanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {activePanel === 'open' && 'Open issues'}
            {activePanel === 'resolved' && `${resolvedIssuesThisWeek.length} issues fixed this week!`}
            {activePanel === 'neighborhoods' && 'Top 5 most affected neighborhoods'}
          </h3>
          <button
            type="button"
            onClick={() => setActivePanel(null)}
            className="text-civic-mist/70 transition hover:text-civic-mist"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {activePanel === 'open' ? (
          <div className="space-y-3">
            {openIssues.map((issue) => (
              <article key={issue.id} className="rounded-2xl border border-[#2D4A2D] bg-[#1A2E1A] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#22C55E]/30 bg-[#1A3420] px-2 py-1 text-xs text-white">{normalizeCategory(issue.category)}</span>
                  <span className={`rounded-full px-2 py-1 text-xs ${SEVERITY_STYLES[normalizeSeverity(issue.severity)]}`}>{normalizeSeverity(issue.severity)}</span>
                </div>
                <p className="mt-2 text-sm text-[#D1D5DB]">{issue.location?.address || 'Address unavailable'}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-[#D1D5DB]">
                  <span>⬆ {issue.upvotes || 0} upvotes</span>
                  <span>{timeAgo(issue)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    focusIssueOnMap(issue.id, true)
                  }}
                  className="mt-3 w-full rounded-xl bg-civic-electric px-3 py-2 text-sm font-semibold shadow-glow transition hover:brightness-110"
                >
                  View on map
                </button>
              </article>
            ))}
          </div>
        ) : null}

        {activePanel === 'resolved' ? (
          <ul className="space-y-3">
            {resolvedIssuesThisWeek.map((issue) => (
              <li key={issue.id} className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3">
                <p className="text-sm text-[#D1D5DB]">
                  ✅ <span className="font-medium">{normalizeCategory(issue.category)}</span> fixed at {issue.location?.address || 'Address unavailable'}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {activePanel === 'neighborhoods' ? (
          <div className="space-y-3">
            {topNeighborhoods.map(([name, count]) => {
              const max = topNeighborhoods[0]?.[1] || 1
              const width = Math.round((count / max) * 100)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setLocationQuery(name)
                    setActivePanel(null)
                  }}
                  className="w-full rounded-2xl border border-[#2D4A2D] bg-[#1A2E1A] p-3 text-left transition hover:bg-[#1E351E]"
                >
                  <div className="mb-2 flex items-center justify-between text-sm text-[#D1D5DB]">
                    <span>{name}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#0B170C]">
                    <div className="h-full rounded-full bg-civic-electric transition-all duration-300" style={{ width: `${width}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}
      </aside>
    </main>
  )
}

function FilterGroup({ label, values, current, onChange }) {
  return (
    <div className="w-full rounded-2xl border border-[#2D4A2D] bg-[#1A2E1A] px-2 py-2 sm:w-auto">
      <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              value === current
                ? 'bg-civic-electric text-black shadow-glow'
                : 'bg-[#132918] text-white hover:bg-[#1E351E]'
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, onClick, accent = 'default' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border border-[#2D4A2D] bg-[#1A2E1A] p-4 text-left shadow-glow transition duration-200 ${
        accent === 'green'
          ? 'hover:border-[#22C55E] hover:bg-[#1E351E] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]'
          : 'hover:border-[#22C55E]/60 hover:bg-[#1E351E]'
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">{icon} {label}</p>
      <p className="mt-2 text-2xl font-bold text-[#FFFFFF]">{value}</p>
    </button>
  )
}

export default DashboardPage
