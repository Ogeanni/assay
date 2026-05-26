import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { getReportHistory } from '../api/client'

const LABEL = {
  Expert:     { bg: 'rgba(124,58,237,0.3)',  text: '#c4b5fd', border: 'rgba(124,58,237,0.4)' },
  Proficient: { bg: 'rgba(124,58,237,0.2)',  text: '#a78bfa', border: 'rgba(124,58,237,0.3)' },
  Developing: { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.12)' },
  Unclear:    { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.08)' },
}

function ScoreBars({ versions }) {
  if (versions.length < 2) return null
  return (
    <div style={{display:'flex', alignItems:'flex-end', gap:3, height:24}}>
      {versions.map((v, i) => (
        <div key={v.id} style={{
          width:8, borderRadius:3,
          height: Math.max((v.depth_score / 100) * 24, 3),
          background: i === versions.length - 1 ? '#7c3aed' : 'rgba(124,58,237,0.3)',
          transition: 'height 0.5s ease',
        }} />
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    getReportHistory()
      .then(res => setGroups(res.data))
      .catch(() => setError('Could not load reports.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout>
      <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:48}}>
        <div>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.08em', marginBottom:12}}>REPORTS</p>
          <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:36, color:'white', marginBottom:8, lineHeight:1.1}}>
            {user?.name}
          </h1>
          {groups.length > 0 && (
            <p style={{fontSize:14, color:'rgba(255,255,255,0.45)'}}>
              {groups.length} {groups.length === 1 ? 'role' : 'roles'} analyzed
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/analyze')}
          style={{
            background:'#f59e0b', color:'#1a0a00', border:'none',
            borderRadius:10, padding:'12px 24px', fontSize:14, fontWeight:600,
            cursor:'pointer', transition:'all 0.2s',
            boxShadow:'0 0 20px rgba(245,158,11,0.25)',
          }}
          onMouseEnter={e => e.currentTarget.style.background='#d97706'}
          onMouseLeave={e => e.currentTarget.style.background='#f59e0b'}
        >
          New analysis →
        </button>
      </div>

      {loading && (
        <div style={{display:'flex', justifyContent:'center', padding:'80px 0'}}>
          <div style={{width:24, height:24, borderRadius:'50%', border:'2px solid rgba(124,58,237,0.3)', borderTopColor:'#a78bfa', animation:'spin 0.8s linear infinite'}} />
        </div>
      )}

      {error && <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#f87171'}}>{error}</p>}

      {!loading && groups.length === 0 && (
        <div style={{textAlign:'center', padding:'80px 32px', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:20}}>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.3)', marginBottom:16}}>No reports yet</p>
          <button
            onClick={() => navigate('/analyze')}
            style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#f59e0b', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}
          >
            Run your first analysis →
          </button>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {groups.map(group => {
            const cfg = LABEL[group.latest_label] || LABEL.Unclear
            const isExpanded = expanded === group.target_role
            const hasVersions = group.version_count > 1

            return (
              <div key={group.target_role} style={{
                background: 'rgba(255,255,255,0.03)',
                border: isExpanded ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16, overflow: 'hidden', transition: 'border-color 0.2s',
              }}>
                <div style={{padding:'20px 24px'}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:16}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:10, flexWrap:'wrap'}}>
                        <p style={{fontSize:16, fontWeight:600, color:'white'}}>{group.target_role}</p>
                        <span style={{
                          fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:500,
                          padding:'4px 10px', borderRadius:100,
                          background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, flexShrink:0,
                        }}>
                          {group.latest_label}
                        </span>
                        {hasVersions && group.improvement !== 0 && (
                          <span style={{
                            fontFamily:'JetBrains Mono,monospace', fontSize:11,
                            padding:'3px 10px', borderRadius:100,
                            background: group.improvement > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                            color: group.improvement > 0 ? '#fcd34d' : '#f87171',
                            border: `1px solid ${group.improvement > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.2)'}`,
                          }}>
                            {group.improvement > 0 ? '↑' : '↓'} {Math.abs(group.improvement)} pts
                          </span>
                        )}
                      </div>

                      <div style={{display:'flex', alignItems:'center', gap:16}}>
                        {hasVersions ? (
                          <div style={{display:'flex', alignItems:'center', gap:8}}>
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:13, color:'rgba(255,255,255,0.35)'}}>{group.first_score}</span>
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.2)'}}>→</span>
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:16, fontWeight:600, color:'#a78bfa'}}>{group.latest_score}</span>
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>/100</span>
                            <ScoreBars versions={group.versions} />
                          </div>
                        ) : (
                          <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:16, fontWeight:600, color:'#a78bfa'}}>
                            {group.latest_score}<span style={{fontSize:11, color:'rgba(255,255,255,0.3)'}}>/100</span>
                          </span>
                        )}
                        <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.3)'}}>
                          {group.version_count} {group.version_count === 1 ? 'version' : 'versions'}
                        </span>
                      </div>
                    </div>

                    <div style={{display:'flex', alignItems:'center', gap:10, flexShrink:0}}>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : group.target_role)}
                        style={{
                          fontFamily:'JetBrains Mono,monospace', fontSize:11,
                          padding:'7px 14px', borderRadius:8,
                          background: isExpanded ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                          color: isExpanded ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                          border: `1px solid ${isExpanded ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          cursor:'pointer', transition:'all 0.2s',
                        }}
                      >
                        {group.version_count} {group.version_count === 1 ? 'version' : 'versions'} {isExpanded ? '↑' : '↓'}
                      </button>
                      <button
                        onClick={() => navigate(`/report/${group.latest_report_id}`)}
                        style={{
                          fontFamily:'JetBrains Mono,monospace', fontSize:11,
                          padding:'7px 16px', borderRadius:8,
                          background:'#f59e0b', color:'#1a0a00',
                          border:'none', cursor:'pointer', transition:'all 0.2s',
                          fontWeight:600,
                        }}
                        onMouseEnter={e => e.target.style.background='#d97706'}
                        onMouseLeave={e => e.target.style.background='#f59e0b'}
                      >
                        View →
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{borderTop:'1px solid rgba(255,255,255,0.06)', padding:'16px 24px'}}>
                    <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:'0.08em', marginBottom:12}}>VERSION HISTORY</p>
                    <div style={{display:'flex', flexDirection:'column', gap:1}}>
                      {[...group.versions].reverse().map((v, i) => {
                        const isLatest = i === 0
                        const vNum = group.versions.length - i
                        const vc = LABEL[v.depth_label] || LABEL.Unclear
                        return (
                          <div key={v.id} style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'10px 0',
                            borderBottom: i < group.versions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          }}>
                            <div style={{display:'flex', alignItems:'center', gap:12}}>
                              <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.25)', width:20}}>v{vNum}</span>
                              <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'3px 8px', borderRadius:100, background: vc.bg, color: vc.text, border:`1px solid ${vc.border}`}}>{v.depth_label}</span>
                              <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:500, color: isLatest ? '#a78bfa' : 'rgba(255,255,255,0.4)'}}>
                                {v.depth_score}/100
                              </span>
                              <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.25)'}}>
                                {new Date(v.created_at).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
                              </span>
                              {isLatest && (
                                <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, padding:'2px 8px', borderRadius:100, background:'rgba(124,58,237,0.2)', color:'#a78bfa', border:'1px solid rgba(124,58,237,0.3)'}}>latest</span>
                              )}
                            </div>
                            <button
                              onClick={() => navigate(`/report/${v.id}`)}
                              style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer'}}
                            >
                              View →
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}