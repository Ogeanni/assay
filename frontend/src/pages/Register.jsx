import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { register } from '../api/client'

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '12px 16px', fontSize: 14, color: 'white',
  outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
}

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
          <span style={{width:22, height:22, borderRadius:6, background:'#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono,monospace', color:'white'}}>A</span>
          ASSAY
        </Link>
      </nav>

      <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 24px', position:'relative', zIndex:1}}>
        <div style={{width:'100%', maxWidth:420}}>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.08em', marginBottom:16}}>— CREATE ACCOUNT</p>
          <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:36, color:'white', marginBottom:8, lineHeight:1.1}}>Get started</h1>
          <p style={{fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:36}}>
            Already have an account?{' '}
            <Link to="/login" style={{color:'#a78bfa', textDecoration:'underline', textUnderlineOffset:3}}>Sign in</Link>
          </p>

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