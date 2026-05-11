import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const inputStyle = {
  width:'100%', background:'rgba(255,255,255,0.06)',
  border:'1px solid rgba(255,255,255,0.1)', borderRadius:10,
  padding:'12px 16px', fontSize:14, color:'white',
  outline:'none', fontFamily:'Inter,sans-serif', boxSizing:'border-box',
}

const darkPage = {
  background:'#160d1e', minHeight:'100vh', color:'white',
  position:'relative', display:'flex', flexDirection:'column',
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null); setLoading(true)
    try { await axios.post(`${BASE_URL}/auth/forgot-password`, { email }); setSubmitted(true) }
    catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div style={darkPage}>
      <div style={{position:'fixed', inset:0, pointerEvents:'none', zIndex:0, background:'radial-gradient(ellipse 120% 60% at 85% 95%, rgba(180,53,9,0.14) 0%, transparent 60%)'}} />
      <div style={{position:'fixed', inset:0, pointerEvents:'none', zIndex:0, background:'radial-gradient(ellipse 80% 50% at 10% 5%, rgba(88,28,135,0.16) 0%, transparent 55%)'}} />
      <nav style={{borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(22,13,30,0.85)', backdropFilter:'blur(12px)', position:'relative', zIndex:10, padding:'0 32px', height:56, display:'flex', alignItems:'center'}}>
        <Link to="/" style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:14, fontWeight:700, color:'white', textDecoration:'none', display:'flex', alignItems:'center', gap:8}}>
          <span style={{width:22, height:22, borderRadius:6, background:'#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono,monospace', color:'white'}}>A</span>
          ASSAY
        </Link>
      </nav>
      <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 24px', position:'relative', zIndex:1}}>
        <div style={{width:'100%', maxWidth:420}}>
          {submitted ? (
            <div>
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.08em', marginBottom:16}}>— CHECK YOUR EMAIL</p>
              <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:32, color:'white', marginBottom:12}}>Reset link sent</h1>
              <p style={{fontSize:14, color:'rgba(255,255,255,0.55)', lineHeight:1.7, marginBottom:8}}>
                If an account exists for <span style={{color:'white', fontWeight:500}}>{email}</span>, you'll receive a reset link shortly.
              </p>
              <p style={{fontSize:13, color:'rgba(255,255,255,0.35)', marginBottom:28}}>Check your spam folder if you don't see it.</p>
              <Link to="/login" style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(167,139,250,0.7)', textDecoration:'none'}}>← Back to sign in</Link>
            </div>
          ) : (
            <div>
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.08em', marginBottom:16}}>— FORGOT PASSWORD</p>
              <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:32, color:'white', marginBottom:8}}>Reset your password</h1>
              <p style={{fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32}}>Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:16}}>
                <div>
                  <label style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.45)', letterSpacing:'0.08em', display:'block', marginBottom:8}}>EMAIL</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                </div>
                {error && <div style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px'}}><p style={{fontSize:13, color:'#fca5a5'}}>{error}</p></div>}
                <button type="submit" disabled={loading} style={{background: loading ? 'rgba(124,58,237,0.4)' : '#7c3aed', color:'white', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:500, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 0 24px rgba(124,58,237,0.3)'}}>
                  {loading ? 'Sending...' : 'Send reset link →'}
                </button>
                <Link to="/login" style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.35)', textDecoration:'none', textAlign:'center'}}>← Back to sign in</Link>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}