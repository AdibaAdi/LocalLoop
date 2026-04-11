import Hero from '../components/Hero'
import Navbar from '../components/Navbar'
import StatsCounter from '../components/StatsCounter'
import HowItWorks from '../components/HowItWorks'
import Footer from '../components/Footer'

function LandingPage({ onReportClick, navigate, user }) {
  return (
    <main className="min-h-screen bg-civic-night text-white">
      <Navbar user={user} navigate={navigate} />
      <Hero onReportClick={onReportClick} />
      <StatsCounter />
      <HowItWorks />
      <Footer />
    </main>
  )
}

export default LandingPage
