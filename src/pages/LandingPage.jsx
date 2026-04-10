import Hero from '../components/Hero'
import Navbar from '../components/Navbar'
import StatsCounter from '../components/StatsCounter'

function LandingPage() {
  return (
    <main className="min-h-screen bg-civic-night text-white">
      <Navbar />
      <Hero />
      <StatsCounter />
    </main>
  )
}

export default LandingPage
