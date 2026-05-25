import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { register } from '../api/client'

const BACKEND_URL = 'https://api.assayai.site/api/v1'

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '12px 16px', fontSize: 14, color: 'white',
  outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
}

const ssoBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 500,
  color: 'white', textDecoration: 'none', transition: 'all 0.2s', width: '100%',
}

const DiamondLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="24" height="24">
    <polygon points="22,1 43,22 22,43 1,22" fill="none" stroke="#7c3aed" strokeWidth="2.5"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="#7c3aed" fillOpacity="0.25"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="none" stroke="#a78bfa" strokeWidth="1.5"/>
    <circle cx="22" cy="22" r="4.5" fill="#a78bfa"/>
  </svg>
)

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { saveToken } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null)
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      const res = await register({ name: form.name, email: form.email, password: form.password })
      saveToken(res.data.access_token)
      navigate('/welcome')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally { setLoading(false) }
  }

  const fields = [
    { name:'name', type:'text', placeholder:'Your name', label:'Name' },
    { name:'email', type:'email', placeholder:'you@example.com', label:'Email' },
    { name:'password', type:'password', placeholder:'••••••••', label:'Password' },
    { name:'confirmPassword', type:'password', placeholder:'••••••••', label:'Confirm Password' },
  ]

  return (
    <div style={{background:'#160d1e', minHeight:'100vh', color:'white', position:'relative', display:'flex', flexDirection:'column'}}>
      <div style={{position:'fixed', inset:0, pointerEvents:'none', zIndex:0, background:'radial-gradient(ellipse 120% 60% at 85% 95%, rgba(180,53,9,0.14) 0%, transparent 60%)'}} />
      <div style={{position:'fixed', inset:0, pointerEvents:'none', zIndex:0, background:'radial-gradient(ellipse 80% 50% at 10% 5%, rgba(88,28,135,0.16) 0%, transparent 55%)'}} />

      <nav style={{borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(22,13,30,0.85)', backdropFilter:'blur(12px)', position:'relative', zIndex:10, padding:'0 32px', height:56, display:'flex', alignItems:'center'}}>
        <Link to="/" style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:14, fontWeight:700, color:'white', textDecoration:'none', display:'flex', alignItems:'center', gap:8}}>
          <DiamondLogo />
          ASSAY
        </Link>
      </nav>

      <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 24px', position:'relative', zIndex:1}}>
        <div style={{width:'100%', maxWidth:420}}>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.08em', marginBottom:16}}>— CREATE ACCOUNT</p>
          <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:36, color:'white', marginBottom:8, lineHeight:1.1}}>Get started</h1>
          <p style={{fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:28}}>
            Already have an account?{' '}
            <Link to="/login" style={{color:'#a78bfa', textDecoration:'underline', textUnderlineOffset:3}}>Sign in</Link>
          </p>

          {/* SSO buttons */}
          <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:20}}>
            <a href={`${BACKEND_URL}/auth/google`} style={{...ssoBtn, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)'}}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
              </svg>
              Continue with Google
            </a>
            <a href={`${BACKEND_URL}/auth/linkedin`} style={{...ssoBtn, background:'rgba(10,102,194,0.15)', border:'1px solid rgba(10,102,194,0.3)'}}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="#0A66C2">
                <path d="M15.3 0H2.7A2.7 2.7 0 0 0 0 2.7v12.6A2.7 2.7 0 0 0 2.7 18h12.6A2.7 2.7 0 0 0 18 15.3V2.7A2.7 2.7 0 0 0 15.3 0zM6 14H3.6V7H6v7zM4.8 5.9a1.35 1.35 0 1 1 0-2.7 1.35 1.35 0 0 1 0 2.7zM15 14h-2.4v-3.4c0-.9-.02-2.05-1.25-2.05-1.25 0-1.44.97-1.44 1.98V14H7.5V7h2.3v.96h.03c.32-.6 1.1-1.23 2.26-1.23 2.42 0 2.86 1.6 2.86 3.67V14z"/>
              </svg>
              Continue with LinkedIn
            </a>
          </div>

          {/* Divider */}
          <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20}}>
            <div style={{flex:1, height:1, background:'rgba(255,255,255,0.08)'}} />
            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>or</span>
            <div style={{flex:1, height:1, background:'rgba(255,255,255,0.08)'}} />
          </div>

          <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:16}}>
            {fields.map(f => (
              <div key={f.name}>
                <label style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.45)', letterSpacing:'0.08em', display:'block', marginBottom:8}}>{f.label.toUpperCase()}</label>
                <input name={f.name} type={f.type} required value={form[f.name]} onChange={handleChange} placeholder={f.placeholder} style={inputStyle} />
              </div>
            ))}

            {error && (
              <div style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px'}}>
                <p style={{fontSize:13, color:'#fca5a5'}}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} style={{background: loading ? 'rgba(124,58,237,0.4)' : '#7c3aed', color:'white', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:500, cursor: loading ? 'not-allowed' : 'pointer', transition:'all 0.2s', boxShadow: loading ? 'none' : '0 0 24px rgba(124,58,237,0.3)', marginTop:4}}>
              {loading ? 'Creating account...' : 'Create account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}