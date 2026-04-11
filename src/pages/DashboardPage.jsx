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


const CHICAGO_IIT_COORDS = [
  { lat: 41.83496, lng: -87.62712, address: '3410 S State St, Chicago, IL 60616' },
  { lat: 41.83718, lng: -87.62588, address: '3140 S Wabash Ave, Chicago, IL 60616' },
  { lat: 41.83614, lng: -87.62882, address: '3200 S Dearborn St, Chicago, IL 60616' },
  { lat: 41.83396, lng: -87.62991, address: '3344 S Federal St, Chicago, IL 60616' },
  { lat: 41.83154, lng: -87.62389, address: '3500 S Michigan Ave, Chicago, IL 60653' },
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
  const [reportOpen, setReportOpen] = useState(autoOpenReport)
  const [filters, setFilters] = useState({ category: 'All', severity: 'All', status: 'All' })

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
        return categoryPass && severityPass && statusPass
      }),
    [issues, filters]
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

  return (
    <main className="min-h-screen bg-civic-night text-white">
      <Navbar user={user} navigate={navigate} />

      <section className="mx-auto max-w-[1400px] px-5 pb-8 pt-5">
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <StatCard icon="📂" label="Open Issues" value={stats.openTotal} />
          <StatCard icon="✅" label="Resolved This Week" value={stats.resolvedThisWeek} />
          <StatCard icon="📍" label="Most Affected Neighborhood" value={stats.topNeighborhood} />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
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
            focusIssueId={selectedIssueId}
          />

          <aside className="glass-card rounded-3xl p-4">
            <h3 className="text-sm uppercase tracking-[0.2em] text-white/60">Top 5 Most Urgent Issues This Week</h3>
            <ul className="mt-4 space-y-2">
              {stats.topUrgent.map((issue, index) => (
                <li key={issue.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedIssueId(issue.id)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10"
                  >
                  <p className="text-xs text-white/55">#{index + 1} · {issue.category}</p>
                  <p className="mt-1 text-sm text-white/90">{issue.description || 'No description provided'}</p>
                  <p className="mt-1 text-xs text-civic-mist">⬆ {issue.upvotes || 0} upvotes</p>
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
    </main>
  )
}

function FilterGroup({ label, values, current, onChange }) {
  return (
    <div className="w-full rounded-2xl border border-white/15 bg-white/5 px-2 py-2 sm:w-auto">
      <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.18em] text-white/50">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              value === current
                ? 'bg-civic-electric text-white shadow-glow'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <article className="glass-card rounded-2xl border-cyan-300/20 p-4 shadow-glow">
      <p className="text-xs uppercase tracking-[0.16em] text-white/55">{icon} {label}</p>
      <p className="mt-2 text-2xl font-semibold text-civic-mist">{value}</p>
    </article>
  )
}

export default DashboardPage
