import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ dark = false }) {
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
        maxWidth: 1100, margin: '0 auto', padding: '0 32px',
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link to="/" style={{
          fontFamily: 'Bricolage Grotesque, sans-serif',
          fontSize: 14, fontWeight: 700,
          color: dark ? 'white' : '#0a0a0a',
          textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: '#7c3aed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'white',
          }}>A</span>
          ASSAY
        </Link>

        <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
          {user ? (
            <>
              {[
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
                fontSize: 12, fontWeight: 500,
                background: '#7c3aed', color: 'white',
                padding: '7px 16px', borderRadius: 8,
                textDecoration: 'none',
                transition: 'background 0.2s',
              }}>
                New analysis
              </Link>
              <div style={{width: 1, height: 16, background: dark ? 'rgba(255,255,255,0.1)' : '#e4e4e7'}} />
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