import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth, loginWithGoogle } from '../lib/firebase'

function Navbar({ user, navigate }) {
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

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

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setMenuOpen(false)
      navigate?.('/')
    } catch (error) {
      console.error('Logout failed', error)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-civic-night/70 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-civic-electric/80 shadow-glow" />
          <Link
            to="/"
            className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-300 bg-clip-text text-left text-lg font-semibold tracking-tight text-transparent"
          >
            LocalLoop
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <button
              type="button"
              onClick={() => navigate?.('/dashboard')}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10"
            >
              Dashboard
            </button>
          ) : null}

          {user ? (
            <button
              type="button"
              onClick={() => navigate?.('/my-reports')}
              className="rounded-full border border-civic-electric/60 bg-civic-electric/20 px-4 py-2 text-sm font-medium text-civic-mist transition hover:bg-civic-electric/35"
            >
              My Reports
            </button>
          ) : null}

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setMenuOpen((prev) => !prev)
                }}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2 py-1 pr-3 text-sm text-white"
              >
                <img
                  src={user.photoURL || 'https://ui-avatars.com/api/?name=User'}
                  alt={user.displayName || 'User'}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="max-w-32 truncate">{user.displayName || 'Signed in'}</span>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-40 overflow-hidden rounded-xl border border-white/15 bg-civic-night shadow-2xl">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-white/90 transition hover:bg-white/10"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogin}
              className="rounded-full border border-civic-electric/70 bg-civic-electric px-5 py-2 text-sm font-medium text-white transition duration-300 hover:scale-105 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Login'}
            </button>
          )}
        </div>
      </nav>
    </header>
  )
}

export default Navbar
