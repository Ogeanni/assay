import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '12px 16px', fontSize: 14, color: 'white',
  outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
}

const sectionStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16, padding: '28px 32px', marginBottom: 16,
}

const labelStyle = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
  color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em',
  display: 'block', marginBottom: 8,
}

const btnPrimary = {
  background: '#7c3aed', color: 'white', border: 'none',
  borderRadius: 8, padding: '10px 20px', fontSize: 13,
  fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
}

const btnSecondary = {
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  padding: '10px 20px', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
}

const PROVIDER_BADGE = {
  google:   { label: 'Google',   bg: 'rgba(66,133,244,0.15)',  border: 'rgba(66,133,244,0.3)',  color: '#93c5fd' },
  linkedin: { label: 'LinkedIn', bg: 'rgba(10,102,194,0.15)',  border: 'rgba(10,102,194,0.3)',  color: '#60a5fa' },
  email:    { label: 'Email',    bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' },
}

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name || '')
  const [nameMsg, setNameMsg] = useState(null)
  const [nameSaving, setNameSaving] = useState(false)

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState(null)
  const [pwSaving, setPwSaving] = useState(false)

  const [stats, setStats] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  useEffect(() => {
    // Load stats from report history
    api.get('/report/history').then(res => {
      const groups = res.data
      const totalReports = groups.reduce((sum, g) => sum + g.version_count, 0)
      const bestScore = groups.reduce((max, g) => Math.max(max, g.latest_score), 0)
      const topRole = groups.length > 0 ? groups[0].target_role : null
      setStats({ totalReports, totalRoles: groups.length, bestScore, topRole })
    }).catch(() => {})
  }, [])

  const saveName = async () => {
    if (!name.trim()) return
    setNameSaving(true); setNameMsg(null)
    try {
      await api.put('/auth/profile', { name: name.trim() })
      setNameMsg({ type: 'success', text: 'Name updated.' })
    } catch {
      setNameMsg({ type: 'error', text: 'Failed to update name.' })
    } finally { setNameSaving(false) }
  }

  const changePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return
    }
    if (pwForm.new_password.length < 8) {
      setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' }); return
    }
    setPwSaving(true); setPwMsg(null)
    try {
      await api.put('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      })
      setPwMsg({ type: 'success', text: 'Password changed.' })
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to change password.' })
    } finally { setPwSaving(false) }
  }

  const deleteAccount = async () => {
    if (deleteInput !== 'DELETE') return
    try {
      await api.delete('/auth/account')
      logout()
      navigate('/')
    } catch {
      setDeleteConfirm(false)
    }
  }

  const provider = PROVIDER_BADGE[user?.auth_provider || 'email']
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const isOAuthUser = user?.auth_provider === 'google' || user?.auth_provider === 'linkedin'

  return (
    <AppLayout>
      <div style={{marginBottom: 40}}>
        <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.08em', marginBottom:12}}>ACCOUNT</p>
        <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:36, color:'white', marginBottom:8, lineHeight:1.1}}>
          Your profile
        </h1>
        <p style={{fontSize:15, color:'rgba(255,255,255,0.55)'}}>Manage your account settings and preferences.</p>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>

        {/* Stats */}
        {stats && (
          <>
            {[
              { label: 'Total analyses', value: stats.totalReports },
              { label: 'Roles analyzed', value: stats.totalRoles },
              { label: 'Best score', value: `${stats.bestScore}/100` },
              { label: 'Most analyzed', value: stats.topRole || '—', small: true },
            ].map(s => (
              <div key={s.label} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'20px 24px'}}>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8}}>{s.label}</p>
                <p style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize: s.small ? 18 : 28, color:'#a78bfa', lineHeight:1}}>{s.value}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Account info */}
      <div style={sectionStyle}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20}}>
          <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:600, fontSize:16, color:'white'}}>Account</h2>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{
              fontFamily:'JetBrains Mono,monospace', fontSize:11,
              padding:'4px 10px', borderRadius:100,
              background: provider.bg, color: provider.color, border: `1px solid ${provider.border}`,
            }}>
              {provider.label}
            </span>
            {joinedDate && (
              <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>
                Joined {joinedDate}
              </span>
            )}
          </div>
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div>
            <label style={labelStyle}>NAME</label>
            <div style={{display:'flex', gap:10}}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={{...inputStyle, flex:1}}
              />
              <button onClick={saveName} disabled={nameSaving} style={{...btnPrimary, opacity: nameSaving ? 0.5 : 1}}>
                {nameSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {nameMsg && (
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, marginTop:6, color: nameMsg.type === 'success' ? '#4ade80' : '#f87171'}}>
                {nameMsg.text}
              </p>
            )}
          </div>

          <div>
            <label style={labelStyle}>EMAIL</label>
            <input value={user?.email || ''} disabled style={{...inputStyle, opacity:0.4, cursor:'not-allowed'}} />
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.25)', marginTop:6}}>
              Email cannot be changed.
            </p>
          </div>
        </div>
      </div>

      {/* Change password — only for email users */}
      {!isOAuthUser && (
        <div style={sectionStyle}>
          <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:600, fontSize:16, color:'white', marginBottom:20}}>
            Change password
          </h2>
          <div style={{display:'flex', flexDirection:'column', gap:14}}>
            {[
              { key:'current_password', label:'CURRENT PASSWORD' },
              { key:'new_password', label:'NEW PASSWORD' },
              { key:'confirm', label:'CONFIRM NEW PASSWORD' },
            ].map(f => (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <input
                  type="password"
                  value={pwForm[f.key]}
                  onChange={e => setPwForm({...pwForm, [f.key]: e.target.value})}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </div>
            ))}
            {pwMsg && (
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color: pwMsg.type === 'success' ? '#4ade80' : '#f87171'}}>
                {pwMsg.text}
              </p>
            )}
            <button onClick={changePassword} disabled={pwSaving} style={{...btnPrimary, alignSelf:'flex-start', opacity: pwSaving ? 0.5 : 1}}>
              {pwSaving ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </div>
      )}

      {isOAuthUser && (
        <div style={sectionStyle}>
          <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:600, fontSize:16, color:'white', marginBottom:8}}>
            Password
          </h2>
          <p style={{fontSize:13, color:'rgba(255,255,255,0.4)'}}>
            You signed in with {provider.label}. Password management is handled by {provider.label}.
          </p>
        </div>
      )}

      {/* Danger zone */}
      <div style={{...sectionStyle, borderColor:'rgba(239,68,68,0.2)', background:'rgba(239,68,68,0.04)'}}>
        <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:600, fontSize:16, color:'#f87171', marginBottom:8}}>
          Danger zone
        </h2>
        <p style={{fontSize:13, color:'rgba(255,255,255,0.45)', marginBottom:20, lineHeight:1.6}}>
          Deleting your account is permanent. All your reports, analyses, and data will be removed and cannot be recovered.
        </p>

        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)} style={{...btnSecondary, borderColor:'rgba(239,68,68,0.3)', color:'#f87171'}}>
            Delete account
          </button>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.5)'}}>
              Type <span style={{color:'white', fontWeight:600}}>DELETE</span> to confirm
            </p>
            <div style={{display:'flex', gap:10}}>
              <input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                style={{...inputStyle, flex:1, borderColor:'rgba(239,68,68,0.3)'}}
              />
              <button
                onClick={deleteAccount}
                disabled={deleteInput !== 'DELETE'}
                style={{...btnPrimary, background:'#dc2626', opacity: deleteInput !== 'DELETE' ? 0.4 : 1}}
              >
                Confirm delete
              </button>
              <button onClick={() => { setDeleteConfirm(false); setDeleteInput('') }} style={btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}