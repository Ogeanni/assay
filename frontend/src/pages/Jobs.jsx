import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { searchJobs } from '../api/client'

function timeAgo(d) {
  if (!d) return ''
  const days = Math.floor((Date.now() - new Date(d)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days/7)}w ago`
  return `${Math.floor(days/30)}mo ago`
}

function formatSalary(min, max) {
  if (!min && !max) return null
  const f = n => n >= 1000 ? `${Math.round(n/1000)}k` : n
  if (min && max) return `£${f(min)} – £${f(max)}`
  if (min) return `From £${f(min)}`
  return `Up to £${f(max)}`
}

const DATE_FILTERS = [
  { label: 'Any time', value: null },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 2 months', value: '60d' },
]

const QUICK_LOCATIONS = ['Remote', 'London', 'New York', 'Singapore', 'Berlin', 'Toronto']

const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '12px 16px',
  fontSize: 14, color: 'white', outline: 'none',
  fontFamily: 'Inter, sans-serif',
}

export default function Jobs() {
  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const [dateFilter, setDateFilter] = useState(null)
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const navigate = useNavigate()

  const search = async (p = 1) => {
    if (!role.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await searchJobs(role.trim(), location.trim() || undefined, p, dateFilter)
      setJobs(res.data.jobs); setTotal(res.data.total); setPage(p); setSearched(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Search failed. Try again.')
    } finally { setLoading(false) }
  }

  const chipStyle = (active) => ({
    fontFamily: 'JetBrains Mono,monospace', fontSize: 11,
    padding: '5px 12px', borderRadius: 100, cursor: 'pointer',
    background: active ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
    color: active ? '#c4b5fd' : 'rgba(255,255,255,0.45)',
    border: `1px solid ${active ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.08)'}`,
    transition: 'all 0.15s',
  })

  return (
    <AppLayout>
      <div style={{marginBottom:40}}>
        <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.08em', marginBottom:12}}>JOB SEARCH</p>
        <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:36, color:'white', marginBottom:8, lineHeight:1.1}}>
          Find a role. Analyze against it.
        </h1>
        <p style={{fontSize:15, color:'rgba(255,255,255,0.55)', lineHeight:1.6}}>
          Search real jobs and run your resume against the actual job description.
        </p>
      </div>

      {/* Search inputs */}
      <div style={{display:'flex', gap:12, marginBottom:16, flexWrap:'wrap'}}>
        <input
          type="text" value={role}
          onChange={e => setRole(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(1)}
          placeholder="Role — e.g. Customer Success Manager"
          style={{...inputStyle, flex:1, minWidth:200}}
        />
        <input
          type="text" value={location}
          onChange={e => setLocation(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(1)}
          placeholder="Location or Remote"
          style={{...inputStyle, width:180}}
        />
        <button
          onClick={() => search(1)}
          disabled={loading || !role.trim()}
          style={{
            background: loading || !role.trim() ? 'rgba(124,58,237,0.3)' : '#7c3aed',
            color:'white', border:'none', borderRadius:10,
            padding:'12px 24px', fontSize:14, fontWeight:500,
            cursor: loading || !role.trim() ? 'not-allowed' : 'pointer',
            transition:'all 0.2s', flexShrink:0,
            boxShadow: loading || !role.trim() ? 'none' : '0 0 20px rgba(124,58,237,0.3)',
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Quick location chips */}
      <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center'}}>
        <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>Location:</span>
        {QUICK_LOCATIONS.map(loc => (
          <button key={loc} onClick={() => setLocation(location === loc ? '' : loc)} style={chipStyle(location === loc)}>
            {loc}
          </button>
        ))}
      </div>

      {/* Date filter chips */}
      <div style={{display:'flex', gap:8, marginBottom:32, alignItems:'center', flexWrap:'wrap'}}>
        <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>Posted:</span>
        {DATE_FILTERS.map(f => (
          <button key={f.label} onClick={() => setDateFilter(f.value)} style={chipStyle(dateFilter === f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'12px 16px', marginBottom:24}}>
          <p style={{fontSize:13, color:'#fca5a5'}}>{error}</p>
        </div>
      )}

      {loading && (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {[...Array(5)].map((_,i) => (
            <div key={i} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:20}}>
              <div style={{height:14, background:'rgba(255,255,255,0.06)', borderRadius:4, width:'45%', marginBottom:10}} />
              <div style={{height:11, background:'rgba(255,255,255,0.04)', borderRadius:4, width:'30%'}} />
            </div>
          ))}
        </div>
      )}

      {!loading && searched && jobs.length === 0 && (
        <div style={{textAlign:'center', padding:'60px 32px', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:20}}>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.3)'}}>No jobs found for "{role}"</p>
          <p style={{fontSize:13, color:'rgba(255,255,255,0.25)', marginTop:8}}>Try a different role, location, or widen the date range</p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.35)', marginBottom:16}}>
            {total.toLocaleString()} jobs · page {page}
            {dateFilter && ` · ${DATE_FILTERS.find(f => f.value === dateFilter)?.label}`}
            {location && ` · ${location}`}
          </p>

          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {jobs.map(job => {
              const isExp = expandedId === job.id
              const salary = formatSalary(job.salary_min, job.salary_max)
              return (
                <div key={job.id} style={{
                  background: isExp ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isExp ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius:14, overflow:'hidden', transition:'all 0.2s',
                }}>
                  <div style={{padding:'18px 24px'}}>
                    <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16}}>
                      <div style={{flex:1, minWidth:0}}>
                        <h3 style={{fontSize:15, fontWeight:600, color:'white', marginBottom:8}}>{job.title}</h3>
                        <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
                          {job.company && <span style={{fontSize:13, color:'rgba(255,255,255,0.6)'}}>{job.company}</span>}
                          {job.location && <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.35)'}}>{job.location}</span>}
                          {salary && <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa'}}>{salary}</span>}
                          {job.contract_type && (
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'2px 8px', borderRadius:100, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.08)'}}>
                              {job.contract_type}
                            </span>
                          )}
                          {job.created && <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.25)'}}>{timeAgo(job.created)}</span>}
                        </div>
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:8, flexShrink:0}}>
                        <button
                          onClick={() => setExpandedId(isExp ? null : job.id)}
                          style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer'}}
                        >
                          {isExp ? 'Less' : 'Preview'}
                        </button>
                        <button
                          onClick={() => navigate('/analyze', { state: { prefill: { targetRole: job.title, jobDescription: job.description } } })}
                          style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'7px 16px', borderRadius:8, background:'#7c3aed', color:'white', border:'none', cursor:'pointer'}}
                        >
                          Analyze →
                        </button>
                      </div>
                    </div>

                    {isExp && job.description && (
                      <div style={{marginTop:16, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                        <p style={{fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.7, display:'-webkit-box', WebkitLineClamp:6, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
                          {job.description}
                        </p>
                        {job.redirect_url && (
                          <a href={job.redirect_url} target="_blank" rel="noopener noreferrer"
                            style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', display:'inline-block', marginTop:12, textDecoration:'underline'}}>
                            View full listing →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:32}}>
            <button onClick={() => search(page-1)} disabled={page===1||loading}
              style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color: page===1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)', background:'none', border:'none', cursor: page===1 ? 'not-allowed' : 'pointer'}}>
              ← Previous
            </button>
            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.25)'}}>Page {page}</span>
            <button onClick={() => search(page+1)} disabled={jobs.length<10||loading}
              style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color: jobs.length<10 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)', background:'none', border:'none', cursor: jobs.length<10 ? 'not-allowed' : 'pointer'}}>
              Next →
            </button>
          </div>
        </>
      )}
    </AppLayout>
  )
}