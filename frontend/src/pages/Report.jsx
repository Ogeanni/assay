import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import AppLayout from '../components/AppLayout'
import { getReport } from '../api/client'

const LABEL = {
  Expert:     { bg:'rgba(124,58,237,0.3)',  text:'#c4b5fd', border:'rgba(124,58,237,0.4)' },
  Proficient: { bg:'rgba(124,58,237,0.2)',  text:'#a78bfa', border:'rgba(124,58,237,0.3)' },
  Developing: { bg:'rgba(255,255,255,0.08)', text:'rgba(255,255,255,0.6)', border:'rgba(255,255,255,0.12)' },
  Unclear:    { bg:'rgba(255,255,255,0.04)', text:'rgba(255,255,255,0.35)', border:'rgba(255,255,255,0.08)' },
}

const SEV = {
  critical: { bg:'rgba(239,68,68,0.08)',  border:'rgba(239,68,68,0.2)',  badge:{bg:'rgba(239,68,68,0.15)',text:'#fca5a5'} },
  moderate: { bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)', badge:{bg:'rgba(245,158,11,0.15)',text:'#fcd34d'} },
  minor:    { bg:'rgba(255,255,255,0.03)', border:'rgba(255,255,255,0.08)', badge:{bg:'rgba(255,255,255,0.08)',text:'rgba(255,255,255,0.5)'} },
}

function AnimatedBar({ score, max=3, delay=0 }) {
  const [w, setW] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setW((score/max)*100), delay); obs.disconnect() }
    }, {threshold:0.3})
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [score, max, delay])
  return (
    <div ref={ref} style={{flex:1, background:'rgba(255,255,255,0.08)', borderRadius:100, height:6, overflow:'hidden'}}>
      <div style={{height:6, borderRadius:100, background:'linear-gradient(90deg,#7c3aed,#a78bfa)', width:`${w}%`, transition:'width 0.8s cubic-bezier(0.4,0,0.2,1)'}} />
    </div>
  )
}

function AnimatedNumber({ value }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let start = null
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts-start)/1000, 1)
      const e = 1 - Math.pow(1-p,3)
      setN(Math.round(e*value*10)/10)
      if (p < 1) requestAnimationFrame(step)
    }
    const t = setTimeout(() => requestAnimationFrame(step), 300)
    return () => clearTimeout(t)
  }, [value])
  return <>{n.toFixed(1)}</>
}

function RationaleText({ text }) {
  if (!text) return null
  const lower = text.toLowerCase()
  const insteadIdx = lower.indexOf('instead of:')
  const tryIdx = lower.indexOf('try:')
  if (insteadIdx === -1 || tryIdx === -1) {
    return <p style={{fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.7}}>{text.trim()}</p>
  }
  const main = text.slice(0, insteadIdx).trim()
  const weak = text.slice(insteadIdx + 'instead of:'.length, tryIdx).replace(/→/g,'').trim()
  const strong = text.slice(tryIdx + 'try:'.length).trim()
  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      {main && <p style={{fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.7}}>{main}</p>}
      <div style={{borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)'}}>
        <div style={{display:'flex', gap:10, padding:'10px 14px', background:'rgba(239,68,68,0.08)'}}>
          <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(239,68,68,0.7)', flexShrink:0}}>✗</span>
          <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.45)', lineHeight:1.5}}>{weak}</span>
        </div>
        <div style={{display:'flex', gap:10, padding:'10px 14px', background:'rgba(124,58,237,0.1)'}}>
          <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', flexShrink:0}}>✓</span>
          <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#c4b5fd', lineHeight:1.5}}>{strong}</span>
        </div>
      </div>
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{
      fontFamily:'JetBrains Mono,monospace', fontSize:10,
      padding:'4px 10px', borderRadius:6, cursor:'pointer',
      background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(245,158,11,0.12)',
      color: copied ? '#4ade80' : '#fcd34d',
      border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.25)'}`,
      transition:'all 0.2s', flexShrink:0,
    }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

export default function Report() {
  const { state } = useLocation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(state?.report || null)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!report && id) {
      setFetching(true)
      getReport(id).then(r => setReport(r.data)).catch(() => setFetchError(true)).finally(() => setFetching(false))
    }
  }, [id])

  if (fetching) return (
    <AppLayout>
      <div style={{display:'flex', justifyContent:'center', padding:'80px 0'}}>
        <div style={{width:24, height:24, borderRadius:'50%', border:'2px solid rgba(124,58,237,0.3)', borderTopColor:'#a78bfa', animation:'spin 0.8s linear infinite'}} />
      </div>
    </AppLayout>
  )

  if (fetchError || !report) return (
    <AppLayout>
      <div style={{textAlign:'center', padding:'80px 32px'}}>
        <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.3)', marginBottom:16}}>Report not found</p>
        <button onClick={() => navigate('/analyze')} style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#f59e0b', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}>
          Run a new analysis →
        </button>
      </div>
    </AppLayout>
  )

  const { depth_score, gaps, positioning, target_role, signal_note } = report
  const lc = LABEL[depth_score.label] || LABEL.Unclear

  return (
    <AppLayout>
      <div style={{display:'flex', flexDirection:'column', gap:24}}>

        {/* Header */}
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16}}>
          <div>
            {/* ANALYSIS COMPLETE — amber: it's a completion moment, human */}
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#f59e0b', letterSpacing:'0.08em', marginBottom:12}}>ANALYSIS COMPLETE</p>
            <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:36, color:'white', lineHeight:1.1}}>{target_role}</h1>
          </div>
          <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:500, padding:'6px 16px', borderRadius:100, background:lc.bg, color:lc.text, border:`1px solid ${lc.border}`, flexShrink:0, marginTop:4}}>
            {depth_score.label}
          </span>
        </div>

        {/* Score card — purple: pure intelligence output */}
        <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, overflow:'hidden', boxShadow:'0 0 0 1px rgba(124,58,237,0.1)'}}>
          <div style={{padding:'32px 36px 24px', background:'linear-gradient(135deg,rgba(124,58,237,0.1) 0%,rgba(245,158,11,0.03) 100%)', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
            <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:28}}>
              <div>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(167,139,250,0.7)', letterSpacing:'0.1em', marginBottom:10}}>DEPTH SCORE</p>
                <div style={{display:'flex', alignItems:'flex-end', gap:8}}>
                  <span style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:80, fontWeight:800, color:'#a78bfa', lineHeight:1, fontVariantNumeric:'tabular-nums'}}>
                    <AnimatedNumber value={depth_score.depth_score} />
                  </span>
                  <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:22, color:'rgba(167,139,250,0.35)', marginBottom:8}}>/100</span>
                </div>
              </div>
              <div style={{textAlign:'right', paddingBottom:8}}>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:6}}>{depth_score.confidence} confidence</p>
                {depth_score.strongest_project && (
                  <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(167,139,250,0.6)'}}>
                    ↑ {depth_score.strongest_project.split('—')[0].trim()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {depth_score.project_scores.map((p, idx) => {
            const pc = LABEL[p.label] || LABEL.Unclear
            return (
              <div key={p.project_name} style={{padding:'24px 36px', borderBottom: idx < depth_score.project_scores.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none'}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
                  <p style={{fontSize:15, fontWeight:600, color:'white'}}>{p.project_name}</p>
                  <div style={{display:'flex', alignItems:'center', gap:10, flexShrink:0, marginLeft:16}}>
                    <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'3px 10px', borderRadius:100, background:pc.bg, color:pc.text, border:`1px solid ${pc.border}`}}>{p.label}</span>
                    <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:13, color:'rgba(167,139,250,0.7)', fontWeight:500}}>{p.depth_score}/100</span>
                  </div>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:16}}>
                  {[
                    {label:'Problem Framing', score:p.problem_framing.score},
                    {label:'Approach & Decisions', score:p.approach_decisions.score},
                    {label:'Adaptability & Learning', score:p.adaptability_learning.score},
                    {label:'Impact & Outcomes', score:p.impact_outcomes.score},
                  ].map((d, i) => (
                    <div key={d.label} style={{display:'flex', alignItems:'center', gap:16}}>
                      <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.45)', width:180, flexShrink:0}}>{d.label}</p>
                      <AnimatedBar score={d.score} delay={idx*100+i*60} />
                      <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(167,139,250,0.6)', width:24, textAlign:'right', flexShrink:0}}>{d.score}/3</p>
                    </div>
                  ))}
                </div>
                <RationaleText text={p.score_rationale} />
              </div>
            )
          })}
        </div>

        {/* Signal note */}
        {signal_note && (
          <div style={{background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:12, padding:'14px 18px'}}>
            <p style={{fontSize:13, color:'#fcd34d', lineHeight:1.6}}>{signal_note}</p>
          </div>
        )}

        {/* Gaps */}
        {gaps.length > 0 && (
          <div>
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.35)', letterSpacing:'0.1em', marginBottom:14}}>GAPS IDENTIFIED</p>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {gaps.map((gap, i) => {
                const sc = SEV[gap.severity] || SEV.minor
                return (
                  <div key={i} style={{background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:14, padding:'18px 22px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'3px 10px', borderRadius:100, background:sc.badge.bg, color:sc.badge.text}}>{gap.severity}</span>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)', textTransform:'capitalize'}}>{gap.dimension.replace(/_/g,' ')}</span>
                    </div>
                    <p style={{fontSize:13, color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:12}}>{gap.description}</p>
                    <p style={{fontSize:13, color:'rgba(255,255,255,0.65)', lineHeight:1.7, marginBottom: gap.rewritten_bullet ? 16 : 0}}>{gap.recommendation}</p>
                    {gap.rewritten_bullet && (
                      <div style={{marginTop:4}}>
                        <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.35)', letterSpacing:'0.08em', marginBottom:10}}>REWRITTEN BULLET — PASTE INTO YOUR CV</p>
                        <div style={{background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.25)', borderRadius:10, padding:'14px 16px', marginBottom: gap.placeholders?.length > 0 ? 10 : 0}}>
                          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12}}>
                            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#c4b5fd', lineHeight:1.7, flex:1}}>{gap.rewritten_bullet}</p>
                            <CopyButton text={gap.rewritten_bullet} />
                          </div>
                        </div>
                        {gap.placeholders?.length > 0 && (
                          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                            {gap.placeholders.map((p, i) => (
                              <span key={i} style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'3px 10px', borderRadius:100, background:'rgba(245,158,11,0.1)', color:'#fcd34d', border:'1px solid rgba(245,158,11,0.2)'}}>
                                Fill in: {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CV Rewrites — purple border left on rewritten, amber on needs_detail */}
        {report.rewrites?.length > 0 && (
          <div>
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.35)', letterSpacing:'0.1em', marginBottom:14}}>YOUR REWRITTEN CV BULLETS</p>
            {report.rewrites.map((rewrite, ri) => (
              <div key={ri} style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, overflow:'hidden', marginBottom:12}}>
                <div style={{padding:'16px 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'linear-gradient(135deg,rgba(124,58,237,0.08) 0%,rgba(245,158,11,0.04) 100%)'}}>
                  <p style={{fontSize:14, fontWeight:600, color:'white', marginBottom:2}}>{rewrite.company}</p>
                  <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)'}}>{rewrite.role}</p>
                </div>
                <div style={{padding:'16px 24px', display:'flex', flexDirection:'column', gap:12}}>
                  {rewrite.bullets?.map((bullet, bi) => (
                    <div key={bi} style={{
                      borderLeft: `3px solid ${bullet.status === 'rewritten' ? '#7c3aed' : bullet.status === 'needs_detail' ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                      paddingLeft:16,
                    }}>
                      {bullet.status === 'rewritten' ? (
                        <div>
                          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(239,68,68,0.7)'}}>✗ original</span>
                          </div>
                          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.3)', lineHeight:1.6, marginBottom:10, textDecoration:'line-through'}}>{bullet.original}</p>
                          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#a78bfa'}}>✓ rewritten</span>
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.25)'}}>{bullet.reason}</span>
                          </div>
                          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom: bullet.placeholders?.length > 0 ? 8 : 0}}>
                            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#c4b5fd', lineHeight:1.6, flex:1}}>{bullet.rewritten}</p>
                            <CopyButton text={bullet.rewritten} />
                          </div>
                          {bullet.placeholders?.length > 0 && (
                            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                              {bullet.placeholders.map((p, pi) => (
                                <span key={pi} style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'3px 10px', borderRadius:100, background:'rgba(245,158,11,0.1)', color:'#fcd34d', border:'1px solid rgba(245,158,11,0.2)'}}>
                                  Fill in: {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : bullet.status === 'needs_detail' ? (
                        <div>
                          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#f59e0b'}}>⚠ needs detail</span>
                          </div>
                          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.4)', lineHeight:1.6, marginBottom:6}}>{bullet.original}</p>
                          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#fcd34d'}}>{bullet.reason}</p>
                        </div>
                      ) : (
                        <div>
                          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                            <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#4ade80'}}>✓ strong — keep</span>
                          </div>
                          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.55)', lineHeight:1.6}}>{bullet.original}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Profile Summary Rewrite */}
        {report.summary_rewrite && (
          <div>
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.35)', letterSpacing:'0.1em', marginBottom:14}}>REWRITTEN PROFILE SUMMARY</p>
            <div style={{background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:14, padding:'20px 24px'}}>
              <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12}}>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#c4b5fd', lineHeight:1.8, flex:1}}>{report.summary_rewrite}</p>
                <CopyButton text={report.summary_rewrite} />
              </div>
              {report.summary_placeholders?.length > 0 && (
                <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:12}}>
                  {report.summary_placeholders.map((p, i) => (
                    <span key={i} style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, padding:'3px 10px', borderRadius:100, background:'rgba(245,158,11,0.1)', color:'#fcd34d', border:'1px solid rgba(245,158,11,0.2)'}}>
                      Fill in: {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Positioning — purple: intelligence output */}
        <div>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.35)', letterSpacing:'0.1em', marginBottom:14}}>POSITIONING STRATEGY</p>
          <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, overflow:'hidden'}}>
            <div style={{padding:'24px 28px', borderBottom:'1px solid rgba(255,255,255,0.05)', background:'linear-gradient(135deg,rgba(124,58,237,0.08) 0%,transparent 60%)'}}>
              <p style={{fontSize:17, fontWeight:600, color:'white', lineHeight:1.6}}>{positioning.headline}</p>
            </div>
            <div style={{padding:'24px 28px', borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:32}}>
                {positioning.lead_with.length > 0 && (
                  <div>
                    <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.35)', letterSpacing:'0.08em', marginBottom:12}}>LEAD WITH</p>
                    <div style={{display:'flex', flexDirection:'column', gap:8}}>
                      {positioning.lead_with.map((item, i) => (
                        <div key={i} style={{display:'flex', alignItems:'flex-start', gap:10, background:'rgba(124,58,237,0.1)', borderRadius:8, padding:'8px 12px', border:'1px solid rgba(124,58,237,0.2)'}}>
                          <span style={{fontSize:13, color:'#a78bfa', flexShrink:0}}>↑</span>
                          <span style={{fontSize:13, color:'#c4b5fd', lineHeight:1.4}}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {positioning.de_emphasize.length > 0 && (
                  <div>
                    <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.35)', letterSpacing:'0.08em', marginBottom:12}}>DE-EMPHASIZE</p>
                    <div style={{display:'flex', flexDirection:'column', gap:8}}>
                      {positioning.de_emphasize.map((item, i) => (
                        <div key={i} style={{display:'flex', alignItems:'flex-start', gap:10, background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 12px', border:'1px solid rgba(255,255,255,0.07)'}}>
                          <span style={{fontSize:13, color:'rgba(255,255,255,0.25)', flexShrink:0}}>↓</span>
                          <span style={{fontSize:13, color:'rgba(255,255,255,0.4)', lineHeight:1.4}}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={{padding:'24px 28px'}}>
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.35)', letterSpacing:'0.08em', marginBottom:14}}>STRATEGY</p>
              <div style={{display:'flex', flexDirection:'column', gap:14}}>
                {positioning.narrative.split('\n\n').filter(Boolean).map((para, i) => (
                  <p key={i} style={{fontSize:14, color:'rgba(255,255,255,0.65)', lineHeight:1.75}}>{para}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions — amber: user action buttons */}
        <div style={{display:'flex', alignItems:'center', gap:16, paddingBottom:40}}>
          <button
            onClick={() => navigate('/analyze')}
            style={{
              background:'#f59e0b', color:'#1a0a00',
              border:'none', borderRadius:10,
              padding:'12px 24px', fontSize:14, fontWeight:600,
              cursor:'pointer',
              boxShadow:'0 0 20px rgba(245,158,11,0.25)',
              transition:'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.background='#d97706'}
            onMouseLeave={e => e.target.style.background='#f59e0b'}
          >
            New analysis →
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer'}}
          >
            All reports
          </button>
        </div>

      </div>
    </AppLayout>
  )
}