import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import Navbar from '../components/Navbar'
import { db } from '../lib/firebase'

function MyReportsPage({ user, navigate }) {
  const [reports, setReports] = useState([])

  useEffect(() => {
    if (!user?.uid) return

    const reportsQuery = query(
      collection(db, 'reports'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    )

    const unsubscribe = onSnapshot(reportsQuery, (snapshot) => {
      setReports(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
    })

    return () => unsubscribe()
  }, [user?.uid])

  return (
    <main className="min-h-screen bg-civic-night text-white">
      <Navbar user={user} navigate={navigate} />

      <section className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-3xl font-semibold text-white">My Reports</h1>
        <p className="mt-2 text-sm text-white/70">Only reports submitted from your account are shown here.</p>

        {reports.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-8 text-center text-white/70">
            You haven't submitted any reports yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reports.map((report) => (
              <article key={report.id} className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
                {report.photo_url ? (
                  <img src={report.photo_url} alt={report.category || 'Issue'} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-white/10 text-white/50">No photo</div>
                )}

                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-civic-electric/50 bg-civic-electric/20 px-3 py-1 text-xs font-semibold text-civic-mist">
                      {report.category || 'Other'}
                    </span>
                    <span className="text-xs uppercase text-white/60">{report.status || 'open'}</span>
                  </div>

                  <p className="text-sm text-white/80">Severity: {report.severity || 'Low'}</p>
                  <p className="text-sm text-white/80">⬆ {report.upvotes || 0} upvotes</p>
                  <p className="text-xs text-white/60">
                    {report.timestamp?.toDate ? report.timestamp.toDate().toLocaleString() : 'Just now'}
                  </p>
                  <p className="line-clamp-2 text-sm text-white/75">{report.description || 'No description provided.'}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default MyReportsPage
