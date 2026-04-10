import Hero from '../components/Hero'
import Navbar from '../components/Navbar'
import StatsCounter from '../components/StatsCounter'

function LandingPage({ onReportClick }) {
  return (
    <main className="min-h-screen bg-civic-night text-white">
      <Navbar />
      <Hero onReportClick={onReportClick} />
      <StatsCounter />
    </main>
  )
}

export default LandingPage
