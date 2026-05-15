import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function OAuthCallback() {
  const [searchParams] = useSearchParams()
  const { saveToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    const isNew = searchParams.get('new') === 'true'

    if (token) {
      saveToken(token)
      navigate(isNew ? '/welcome' : '/analyze', { replace: true })
    } else {
      navigate('/login?error=oauth_failed', { replace: true })
    }
  }, [])

  return (
    <div style={{
      background: '#160d1e', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{textAlign: 'center'}}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2px solid rgba(124,58,237,0.3)',
          borderTopColor: '#a78bfa',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12, color: 'rgba(255,255,255,0.4)',
        }}>
          Signing you in...
        </p>
      </div>
    </div>
  )
}