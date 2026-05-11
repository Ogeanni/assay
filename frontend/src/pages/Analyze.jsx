import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { analyzeResume } from '../api/client'

const STEPS = [
  'Connected. Starting analysis...',
  'Resume loaded. Scoring depth...',
  'Depth scoring complete. Analyzing gaps...',
  'Gap analysis complete. Generating positioning...',
  'Positioning complete. Assembling report...',
]
const JD_LIMIT = 4000

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
}

const label = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  color: 'rgba(255,255,255,0.5)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 8,
}

const input = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '12px 16px',
  fontSize: 14,
  color: 'white',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box',
}

function parseError(err) {
  const status = err.response?.status
  const detail = err.response?.data?.detail
  if (status === 413) return 'Your PDF is too large. Please upload a file under 5MB.'
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status === 500) return 'Something went wrong on our end. Please try again.'
  if (detail) return detail
  if (!err.response) return 'Could not reach the server. Check your connection.'
  return 'Analysis failed. Please try again.'
}

export default function Analyze() {
  const [file, setFile] = useState(null)
  const [targetRole, setTargetRole] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [completedSteps, setCompletedSteps] = useState([])
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const prefill = location.state?.prefill
    if (prefill) {
      if (prefill.targetRole) setTargetRole(prefill.targetRole)
      if (prefill.jobDescription) setJobDescription(prefill.jobDescription.slice(0, JD_LIMIT))
    }
  }, [])

  const handleFile = (selected) => {
    if (!selected) return
    if (selected.type !== 'application/pdf') { setError('Only PDF files are accepted.'); return }
    if (selected.size > 5 * 1024 * 1024) { setError('File too large. Maximum size is 5MB.'); return }
    setFile(selected); setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !targetRole.trim()) return
    setLoading(true); setCompletedSteps([]); setError(null)

    let idx = 0
    const interval = setInterval(() => {
      if (idx < STEPS.length - 1) { setCompletedSteps(p => [...p, STEPS[idx]]); idx++ }
    }, 4000)

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('target_role', targetRole)
      if (jobDescription.trim()) fd.append('job_description', jobDescription.trim())

      const res = await analyzeResume(fd)
      clearInterval(interval)
      setCompletedSteps(STEPS)
      setTimeout(() => navigate(`/report/${res.data.report_id}`, { state: { report: res.data } }), 500)
    } catch (err) {
      clearInterval(interval)
      setError(parseError(err))
      setLoading(false); setCompletedSteps([])
    }
  }

  const jdLeft = JD_LIMIT - jobDescription.length

  return (
    <AppLayout maxWidth="800px">
      <div style={{marginBottom: 40}}>
        <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.08em', marginBottom:12}}>NEW ANALYSIS</p>
        <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:36, color:'white', marginBottom:8, lineHeight:1.1}}>
          Analyze your resume
        </h1>
        <p style={{fontSize:15, color:'rgba(255,255,255,0.55)', lineHeight:1.6}}>
          Upload your PDF and name the role you are targeting.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:24}}>

        {/* File upload */}
        <div>
          <span style={label}>Resume (PDF)</span>
          <div
            onClick={() => !loading && fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            style={{
              ...card,
              padding: '48px 32px',
              textAlign: 'center',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              borderColor: file ? 'rgba(124,58,237,0.5)' : dragging ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)',
              background: file ? 'rgba(124,58,237,0.08)' : dragging ? 'rgba(124,58,237,0.05)' : 'rgba(255,255,255,0.03)',
              transition: 'all 0.2s',
            }}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => handleFile(e.target.files[0])} style={{display:'none'}} />
            {file ? (
              <div>
                <div style={{fontSize:32, marginBottom:12}}>📄</div>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:13, color:'white', marginBottom:4}}>{file.name}</p>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:12}}>
                  {(file.size/1024/1024).toFixed(2)} MB
                </p>
                {!loading && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={{fontSize:32, marginBottom:12}}>⬆️</div>
                <p style={{fontSize:14, color:'rgba(255,255,255,0.6)', marginBottom:6}}>
                  Drop your PDF here or <span style={{color:'#a78bfa', textDecoration:'underline'}}>browse</span>
                </p>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>PDF only · max 5MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Target role */}
        <div>
          <span style={label}>Target role</span>
          <input
            type="text"
            value={targetRole}
            onChange={e => setTargetRole(e.target.value)}
            placeholder="e.g. AI Engineer, Customer Success Manager"
            disabled={loading}
            required
            style={{...input, opacity: loading ? 0.5 : 1}}
          />
        </div>

        {/* Job description */}
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
            <span style={{...label, marginBottom:0}}>Job description</span>
            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color: jdLeft < 500 ? '#f59e0b' : 'rgba(255,255,255,0.3)'}}>
              {jobDescription.length > 0 ? `${jdLeft} left` : 'optional'}
            </span>
          </div>
          <textarea
            value={jobDescription}
            onChange={e => e.target.value.length <= JD_LIMIT && setJobDescription(e.target.value)}
            placeholder="Paste the job description for role-specific gap analysis..."
            disabled={loading}
            rows={5}
            style={{...input, resize:'none', lineHeight:1.6, opacity: loading ? 0.5 : 1}}
          />
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:8}}>
            With a JD, gaps and positioning are specific to this role — not generic
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'12px 16px'}}>
            <p style={{fontSize:13, color:'#fca5a5'}}>{error}</p>
          </div>
        )}

        {/* Progress */}
        {loading && (
          <div style={{...card, padding:'20px 24px', display:'flex', flexDirection:'column', gap:12}}>
            {completedSteps.map((msg, i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:12}}>
                <div style={{width:16, height:16, borderRadius:'50%', background:'#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <span style={{fontSize:9, color:'white'}}>✓</span>
                </div>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.6)'}}>{msg}</p>
              </div>
            ))}
            {completedSteps.length < STEPS.length && (
              <div style={{display:'flex', alignItems:'center', gap:12}}>
                <div style={{width:16, height:16, borderRadius:'50%', border:'2px solid rgba(124,58,237,0.5)', borderTopColor:'#a78bfa', animation:'spin 0.8s linear infinite', flexShrink:0}} />
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.4)'}}>{STEPS[completedSteps.length]}</p>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file || !targetRole.trim()}
          style={{
            background: loading || !file || !targetRole.trim() ? 'rgba(124,58,237,0.3)' : '#7c3aed',
            color: 'white', border: 'none', borderRadius: 10,
            padding: '14px 28px', fontSize: 15, fontWeight: 500,
            cursor: loading || !file || !targetRole.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: loading || !file || !targetRole.trim() ? 'none' : '0 0 24px rgba(124,58,237,0.3)',
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze resume →'}
        </button>
      </form>
    </AppLayout>
  )
}