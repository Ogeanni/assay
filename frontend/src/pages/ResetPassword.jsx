import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const inputStyle = {
  width:'100%', background:'rgba(255,255,255,0.06)',
  border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
  padding:'12px 16px', fontSize:14, color:'white',
  outline:'none', fontFamily:'Inter,sans-serif', boxSizing:'border-box',
}

const DiamondLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="24" height="24">
    <polygon points="22,1 43,22 22,43 1,22" fill="none" stroke="#7c3aed" strokeWidth="2.5"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="#7c3aed" fillOpacity="0.25"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="none" stroke="#a78bfa" strokeWidth="1.5"/>
    <circle cx="22" cy="22" r="4.5" fill="#a78bfa"/>
  </svg>
)

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null)
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await axios.post(`${BASE_URL}/auth/reset-password`, { token, password: form.password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed. The link may have expired.')
    } finally { setLoading(false) }
  }

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
          {!token ? (
            <div style={{textAlign:'center'}}>
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#fca5a5', marginBottom:16}}>Invalid reset link</p>
              <Link to="/forgot-password" style={{fontSize:14, color:'#a78bfa', textDecoration:'underline'}}>Request a new one →</Link>
            </div>
          ) : success ? (
            <div>
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#4ade80', letterSpacing:'0.08em', marginBottom:16}}>— SUCCESS</p>
              <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:32, color:'white', marginBottom:8}}>Password updated</h1>
              <p style={{fontSize:14, color:'rgba(255,255,255,0.5)'}}>Redirecting you to sign in...</p>
            </div>
          ) : (
            <div>
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.08em', marginBottom:16}}>— RESET PASSWORD</p>
              <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:32, color:'white', marginBottom:8}}>New password</h1>
              <p style={{fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32}}>Choose a new password for your account.</p>
              <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:16}}>
                {['password','confirmPassword'].map(f => (
                  <div key={f}>
                    <label style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.45)', letterSpacing:'0.08em', display:'block', marginBottom:8}}>
                      {f === 'password' ? 'NEW PASSWORD' : 'CONFIRM PASSWORD'}
                    </label>
                    <input name={f} type="password" required value={form[f]} onChange={e => setForm({...form,[e.target.name]:e.target.value})} placeholder="••••••••" style={inputStyle} />
                  </div>
                ))}
                {error && <div style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px'}}><p style={{fontSize:13, color:'#fca5a5'}}>{error}</p></div>}
                <button type="submit" disabled={loading} style={{background: loading ? 'rgba(124,58,237,0.4)' : '#7c3aed', color:'white', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:500, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 0 24px rgba(124,58,237,0.3)'}}>
                  {loading ? 'Updating...' : 'Update password →'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}