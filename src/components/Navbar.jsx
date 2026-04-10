import { useState } from 'react'
import { loginWithGoogle } from '../lib/firebase'

function Navbar() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    try {
      setLoading(true)
      await loginWithGoogle()
    } catch (error) {
      console.error('Google sign-in failed', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-civic-night/70 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-civic-electric/80 shadow-glow" />
          <span className="text-lg font-semibold tracking-tight text-white">LocalLoop</span>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          className="rounded-full border border-civic-electric/70 bg-civic-electric px-5 py-2 text-sm font-medium text-white transition duration-300 hover:scale-105 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Connecting...' : 'Login'}
        </button>
      </nav>
    </header>
  )
}

export default Navbar
