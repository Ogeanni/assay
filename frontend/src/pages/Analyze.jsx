import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { analyzeResume, searchJobs } from '../api/client'

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

const labelStyle = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  color: 'rgba(255,255,255,0.5)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 8,
}

const inputStyle = {
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

function JobSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await searchJobs(query.trim(), undefined, 1)
      setJobs(res.data.jobs)
      setSearched(true)
      setExpanded(true)
    } catch {}
    finally { setLoading(false) }
  }

  const select = (job) => {
    onSelect(job)
    setExpanded(false)
    setQuery(job.title)
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <span style={labelStyle}>Browse jobs</span>
        <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>optional — or paste your own JD below</span>
      </div>

      <div style={{display:'flex', gap:10, marginBottom: expanded && jobs.length > 0 ? 12 : 0}}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search a role — e.g. Customer Success Manager"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={search}
          disabled={loading || !query.trim()}
          style={{
            background: loading || !query.trim() ? 'rgba(124,58,237,0.3)' : '#7c3aed',
            color:'white', border:'none', borderRadius:10,
            padding:'12px 20px', fontSize:13, fontWeight:500,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            flexShrink:0, transition:'all 0.2s',
            fontFamily:'JetBrains Mono,monospace',
          }}
        >
          {loading ? '...' : 'Search'}
        </button>
      </div>

      {expanded && jobs.length > 0 && (
        <div style={{
          background:'rgba(0,0,0,0.3)',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:12,
          overflow:'hidden',
          maxHeight:280,
          overflowY:'auto',
        }}>
          {jobs.map((job, i) => (
            <div
              key={job.id}
              onClick={() => select(job)}
              style={{
                padding:'14px 18px',
                borderBottom: i < jobs.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                cursor:'pointer',
                transition:'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(124,58,237,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              <p style={{fontSize:13, fontWeight:600, color:'white', marginBottom:4}}>{job.title}</p>
              <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
                {job.company && <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.45)'}}>{job.company}</span>}
                {job.location && <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>{job.location}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {searched && jobs.length === 0 && !loading && (
        <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:8}}>
          No jobs found. Try a different search or paste a JD below.
        </p>
      )}
    </div>
  )
}

export default function Analyze() {
  const [file, setFile] = useState(null)
  const [targetRole, setTargetRole] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
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

  const handleJobSelect = (job) => {
    setSelectedJob(job)
    setTargetRole(job.title)
    setJobDescription(job.description.slice(0, JD_LIMIT))
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
          Upload your PDF, find a role or paste a JD, and get your depth score.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:24}}>

        {/* File upload */}
        <div>
          <span style={labelStyle}>Resume (PDF)</span>
          <div
            onClick={() => !loading && fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            style={{
              ...card,
              padding: '40px 32px',
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
                <div style={{fontSize:28, marginBottom:10}}>📄</div>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:13, color:'white', marginBottom:4}}>{file.name}</p>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:10}}>
                  {(file.size/1024/1024).toFixed(2)} MB
                </p>
                {!loading && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}>
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={{fontSize:28, marginBottom:10}}>⬆️</div>
                <p style={{fontSize:14, color:'rgba(255,255,255,0.6)', marginBottom:4}}>
                  Drop your PDF here or <span style={{color:'#a78bfa', textDecoration:'underline'}}>browse</span>
                </p>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>PDF only · max 5MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Job search */}
        <JobSearch onSelect={handleJobSelect} />

        {/* Selected job indicator */}
        {selectedJob && (
          <div style={{
            background:'rgba(124,58,237,0.1)',
            border:'1px solid rgba(124,58,237,0.25)',
            borderRadius:10, padding:'12px 16px',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <div>
              <p style={{fontSize:13, fontWeight:600, color:'#c4b5fd', marginBottom:2}}>{selectedJob.title}</p>
              {selectedJob.company && <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(167,139,250,0.6)'}}>{selectedJob.company}</p>}
            </div>
            <button
              type="button"
              onClick={() => { setSelectedJob(null); setTargetRole(''); setJobDescription('') }}
              style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(167,139,250,0.5)', background:'none', border:'none', cursor:'pointer'}}
            >
              Clear ✕
            </button>
          </div>
        )}

        {/* Target role */}
        <div>
          <span style={labelStyle}>Target role</span>
          <input
            type="text"
            value={targetRole}
            onChange={e => setTargetRole(e.target.value)}
            placeholder="e.g. AI Engineer, Customer Success Manager"
            disabled={loading}
            required
            style={{...inputStyle, opacity: loading ? 0.5 : 1}}
          />
        </div>

        {/* Job description */}
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
            <span style={{...labelStyle, marginBottom:0}}>Job description</span>
            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color: jdLeft < 500 ? '#f59e0b' : 'rgba(255,255,255,0.3)'}}>
              {jobDescription.length > 0 ? `${jdLeft} left` : 'optional'}
            </span>
          </div>
          <textarea
            value={jobDescription}
            onChange={e => e.target.value.length <= JD_LIMIT && setJobDescription(e.target.value)}
            placeholder="Paste a job description here for role-specific gap analysis..."
            disabled={loading}
            rows={5}
            style={{...inputStyle, resize:'none', lineHeight:1.6, opacity: loading ? 0.5 : 1}}
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
                <div style={{width:16, height:16, borderRadius:'50%', border:'2px solid rgba(124,58,237,0.4)', borderTopColor:'#a78bfa', animation:'spin 0.8s linear infinite', flexShrink:0}} />
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
            color:'white', border:'none', borderRadius:10,
            padding:'14px 28px', fontSize:15, fontWeight:500,
            cursor: loading || !file || !targetRole.trim() ? 'not-allowed' : 'pointer',
            transition:'all 0.2s',
            boxShadow: loading || !file || !targetRole.trim() ? 'none' : '0 0 24px rgba(124,58,237,0.3)',
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze resume →'}
        </button>
      </form>
    </AppLayout>
  )
}