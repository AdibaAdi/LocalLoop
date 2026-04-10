import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import Navbar from '../components/Navbar'
import ReportIssueModal from '../components/ReportIssueModal'
import IssueMap from '../components/IssueMap'
import { db } from '../lib/firebase'

const FILTERS = {
  category: ['All', 'Pothole', 'Flooding', 'Broken Light', 'Graffiti', 'Safety Hazard', 'Other'],
  severity: ['All', 'Critical', 'Medium', 'Low'],
  status: ['All', 'Open', 'Escalated', 'Resolved'],
}

const statusNorm = (status) => {
  if (!status) return 'Open'
  const value = String(status).toLowerCase()
  if (value === 'resolved') return 'Resolved'
  if (value === 'escalated') return 'Escalated'
  return 'Open'
}

function DashboardPage({ navigate, autoOpenReport }) {
  const [issues, setIssues] = useState([])
  const [selectedIssueId, setSelectedIssueId] = useState('')
  const [reportOpen, setReportOpen] = useState(autoOpenReport)
  const [filters, setFilters] = useState({ category: 'All', severity: 'All', status: 'All' })

  useEffect(() => {
    setReportOpen(autoOpenReport)
  }, [autoOpenReport])

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
        const categoryPass = filters.category === 'All' || issue.category === filters.category
        const severityPass = filters.severity === 'All' || issue.severity === filters.severity
        const statusPass = filters.status === 'All' || statusNorm(issue.status) === filters.status
        return categoryPass && severityPass && statusPass
      }),
    [issues, filters]
  )

  const selectedIssue = useMemo(
    () => filteredIssues.find((issue) => issue.id === selectedIssueId) || filteredIssues[0],
    [filteredIssues, selectedIssueId]
  )

  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const openTotal = issues.filter((item) => statusNorm(item.status) !== 'Resolved').length
    const resolvedThisWeek = issues.filter((item) => {
      const stamp = item.timestamp?.toDate?.() || item.updatedAt?.toDate?.()
      return statusNorm(item.status) === 'Resolved' && stamp && stamp.getTime() >= weekAgo
    }).length

    const neighborhoodCounts = issues.reduce((acc, issue) => {
      const key = issue.location?.address?.split(',')?.slice(-3, -2)?.[0]?.trim() || 'Unknown area'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const [topNeighborhood = 'Unknown area'] = Object.entries(neighborhoodCounts).sort((a, b) => b[1] - a[1])[0] || []

    const topUrgent = [...issues]
      .filter((issue) => {
        const stamp = issue.timestamp?.toDate?.()
        return !stamp || stamp.getTime() >= weekAgo
      })
      .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
      .slice(0, 5)

    return { openTotal, resolvedThisWeek, topNeighborhood, topUrgent }
  }, [issues])

  return (
    <main className="min-h-screen bg-civic-night text-white">
      <Navbar />

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
          />

          <aside className="glass-card rounded-3xl p-4">
            <h3 className="text-sm uppercase tracking-[0.2em] text-white/60">Top 5 Most Urgent Issues This Week</h3>
            <ul className="mt-4 space-y-2">
              {stats.topUrgent.map((issue, index) => (
                <li key={issue.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-white/55">#{index + 1} · {issue.category}</p>
                  <p className="mt-1 text-sm text-white/90">{issue.description || 'No description provided'}</p>
                  <p className="mt-1 text-xs text-civic-mist">⬆ {issue.upvotes || 0} upvotes</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <ReportIssueModal
        isOpen={reportOpen}
        onClose={() => {
          setReportOpen(false)
          navigate('/dashboard')
        }}
      />
    </main>
  )
}

function FilterGroup({ label, values, current, onChange }) {
  return (
    <div className="rounded-full border border-white/15 bg-white/5 px-2 py-2">
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
