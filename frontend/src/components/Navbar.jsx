import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const DiamondLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="24" height="24">
    <defs>
      <linearGradient id="dg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7c3aed"/>
        <stop offset="100%" stopColor="#f59e0b"/>
      </linearGradient>
      <linearGradient id="dg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a78bfa"/>
        <stop offset="100%" stopColor="#fcd34d"/>
      </linearGradient>
    </defs>
    <polygon points="22,1 43,22 22,43 1,22" fill="none" stroke="url(#dg1)" strokeWidth="2.5"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="url(#dg1)" fillOpacity="0.35"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="none" stroke="url(#dg2)" strokeWidth="1.5"/>
    <circle cx="22" cy="22" r="5" fill="url(#dg1)"/>
  </svg>
)

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

export default function Navbar({ dark = false }) {
  const width = useWindowWidth()
  const isMobile = width < 768
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isActive = (p) => location.pathname === p

  const textColor = dark ? 'rgba(255,255,255,0.65)' : '#71717a'
  const textActive = dark ? 'white' : '#0a0a0a'
  const border = dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid #f4f4f5'
  const bg = dark ? 'rgba(22,13,30,0.85)' : 'rgba(255,255,255,0.9)'

  return (
    <nav style={{
      borderBottom: border,
      background: bg,
      backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 16px' : '0 32px',
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link to="/" style={{
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontSize: 14, fontWeight: 700,
          color: dark ? 'white' : '#0a0a0a',
          textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <DiamondLogo />
          ASSAY
        </Link>

        <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
          {user ? (
            <>
              {!isMobile && [
                { to: '/jobs',      label: 'Jobs' },
                { to: '/dashboard', label: 'Reports' },
                { to: '/profile',   label: 'Profile' },
              ].map(({ to, label }) => (
                <Link key={to} to={to} style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  color: isActive(to) ? textActive : textColor,
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}>
                  {label}
                </Link>
              ))}
              <Link to="/analyze" style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12, fontWeight: 600,
                background: '#f59e0b', color: '#1a0a00',
                padding: isMobile ? '7px 12px' : '7px 16px', borderRadius: 8,
                textDecoration: 'none',
                transition: 'background 0.2s',
              }}>
                {isMobile ? '+ New' : 'New analysis'}
              </Link>
              {!isMobile && <div style={{width: 1, height: 16, background: dark ? 'rgba(255,255,255,0.1)' : '#e4e4e7'}} />}
              {!isMobile && (
                <button
                  onClick={() => { logout(); navigate('/') }}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12, color: textColor,
                    background: 'none', border: 'none', cursor: 'pointer',
                    transition: 'color 0.2s',
                  }}
                >
                  Sign out
                </button>
              )}
              {isMobile && (
                <button
                  onClick={() => { logout(); navigate('/') }}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11, color: textColor,
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  Out
                </button>
              )}
            </>
          ) : (
            <>
              <Link to="/login" style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12, color: textColor,
                textDecoration: 'none',
              }}>
                Sign in
              </Link>
              <Link to="/register" style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12, fontWeight: 500,
                background: '#7c3aed', color: 'white',
                padding: '7px 16px', borderRadius: 8,
                textDecoration: 'none',
              }}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}