import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import MyReportsPage from './pages/MyReportsPage'
import { auth } from './lib/firebase'

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [search, setSearch] = useState(window.location.search)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname)
      setSearch(window.location.search)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser)
    })

    return () => unsubscribe()
  }, [])

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setPath(window.location.pathname)
    setSearch(window.location.search)
  }

  const openReport = useMemo(() => new URLSearchParams(search).get('report') === '1', [search])

  if (path === '/dashboard') {
    return <DashboardPage navigate={navigate} autoOpenReport={openReport} user={user} />
  }

  if (path === '/my-reports') {
    if (!user) {
      navigate('/')
      return null
    }

    return <MyReportsPage navigate={navigate} user={user} />
  }

  return <LandingPage onReportClick={() => navigate('/dashboard?report=1')} navigate={navigate} user={user} />
}

export default App
