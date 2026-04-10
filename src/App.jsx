import { useEffect, useMemo, useState } from 'react'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [search, setSearch] = useState(window.location.search)

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname)
      setSearch(window.location.search)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setPath(window.location.pathname)
    setSearch(window.location.search)
  }

  const openReport = useMemo(() => new URLSearchParams(search).get('report') === '1', [search])

  if (path === '/dashboard') {
    return <DashboardPage navigate={navigate} autoOpenReport={openReport} />
  }

  return <LandingPage onReportClick={() => navigate('/dashboard?report=1')} />
}

export default App
