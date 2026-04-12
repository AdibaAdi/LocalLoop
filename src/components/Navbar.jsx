import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth, loginWithGoogle } from '../lib/firebase'

function Navbar({ user, navigate }) {
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const menuRef = useRef(null)
  const firstName = user?.displayName?.split(' ')?.[0] || 'User'
  const avatarSrc = auth.currentUser?.photoURL || user?.photoURL || ''

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    setAvatarError(false)
  }, [avatarSrc])

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
    <header className="sticky top-0 z-30 border-b border-[rgba(34,197,94,0.2)] bg-[#0A0A0A]/95 backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-civic-electric/80 shadow-glow" />
          <Link
            to="/"
            className="bg-gradient-to-r from-green-300 via-emerald-300 to-green-200 bg-clip-text text-left text-lg font-semibold tracking-tight text-transparent"
          >
            LocalLoop
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <button
              type="button"
              onClick={() => navigate?.('/dashboard')}
              className="rounded-full border border-[rgba(34,197,94,0.3)] bg-[#111811] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a261a]"
            >
              Dashboard
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
                className="flex items-center gap-2 rounded-full border border-[rgba(34,197,94,0.3)] bg-[#111811] px-2 py-1 pr-3 text-sm text-white"
              >
                {avatarSrc && !avatarError ? (
                  <img
                    src={avatarSrc}
                    alt={user.displayName || 'User'}
                    className="h-8 w-8 rounded-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white">
                    {user.displayName?.[0] || 'U'}
                  </div>
                )}
                <span className="max-w-24 truncate font-medium">{firstName}</span>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-40 overflow-hidden rounded-xl border border-[rgba(34,197,94,0.3)] bg-[#111811] shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate?.('/my-reports')
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white/90 transition hover:bg-civic-electric/15"
                  >
                    My Reports
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-white/90 transition hover:bg-civic-electric/15"
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
