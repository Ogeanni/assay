import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

const MARQUEE_ITEMS = [
  'Different career types', 'Work experience first', 'JD-specific gaps',
  'Before & after rewrites', 'Version tracking', 'Real job listings',
  'Seniority-aware', 'Career-agnostic', 'Depth over keywords',
  'Not an ATS', 'Honest scoring', 'Built for humans',
]

const RUBRIC = [
  { icon: '🎯', name: 'Problem Framing',         q: 'Did you know why it mattered?',     score: 3 },
  { icon: '🧭', name: 'Approach & Decisions',    q: 'Did you think before acting?',      score: 3 },
  { icon: '🔄', name: 'Adaptability & Learning', q: 'Did you adapt when it failed?',     score: 2 },
  { icon: '📈', name: 'Impact & Outcomes',        q: 'Did it change anything measurable?', score: 3 },
]

function useInView(threshold = 0.12) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); obs.disconnect() }
    }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return [ref, inView]
}

function AnimateIn({ children, delay = 0, style = {} }) {
  const [ref, inView] = useInView()
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.8s ${delay}s cubic-bezier(0.4,0,0.2,1), transform 0.8s ${delay}s cubic-bezier(0.4,0,0.2,1)`,
      ...style,
    }}>
      {children}
    </div>
  )
}

function AnimatedScore() {
  const [ref, inView] = useInView()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!inView) return
    let c = 0
    const step = () => { c += 2; if (c >= 83) { setCount(83); return }; setCount(c); requestAnimationFrame(step) }
    setTimeout(() => requestAnimationFrame(step), 300)
  }, [inView])
  return (
    <div ref={ref} className="flex items-end gap-2">
      <span style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:72, fontWeight:800, color:'#f59e0b', lineHeight:1, fontVariantNumeric:'tabular-nums'}}>
        {count}
      </span>
      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:22, color:'rgba(245,158,11,0.5)', marginBottom:8}}>/100</span>
    </div>
  )
}

const DiamondLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="24" height="24">
    <polygon points="22,1 43,22 22,43 1,22" fill="none" stroke="#7c3aed" strokeWidth="2.5"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="#7c3aed" fillOpacity="0.25"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="none" stroke="#a78bfa" strokeWidth="1.5"/>
    <circle cx="22" cy="22" r="4.5" fill="#a78bfa"/>
  </svg>
)

export default function Landing() {
  return (
    <div style={{background:'#18181b', minHeight:'100vh', color:'white'}}>

      {/* ── Navbar ─────────────────────────────── */}
      <nav style={{
        borderBottom:'1px solid rgba(255,255,255,0.06)',
        background:'rgba(24,24,27,0.85)',
        backdropFilter:'blur(12px)',
        position:'sticky', top:0, zIndex:50,
      }}>
        <div style={{maxWidth:1100, margin:'0 auto', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <Link to="/" style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:14, fontWeight:700, color:'white', textDecoration:'none', display:'flex', alignItems:'center', gap:10}}>
            <DiamondLogo />
            ASSAY
          </Link>
          <div style={{display:'flex', alignItems:'center', gap:24}}>
            <Link to="/login" style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.65)', textDecoration:'none'}}>Sign in</Link>
            <Link to="/register" style={{
              fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:500,
              background:'#f59e0b', color:'#1a0a00', padding:'8px 18px',
              borderRadius:8, textDecoration:'none', transition:'background 0.2s',
            }}
              onMouseEnter={e => e.target.style.background='#d97706'}
              onMouseLeave={e => e.target.style.background='#f59e0b'}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────── */}
      <section style={{maxWidth:1100, margin:'0 auto', padding:'100px 24px 80px', position:'relative'}}>
        <div style={{position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)', width:900, height:600, background:'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 65%)', pointerEvents:'none'}} />
        <div style={{position:'absolute', bottom:-200, right:-100, width:700, height:600, background:'radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 65%)', pointerEvents:'none'}} />

        <div style={{position:'relative', zIndex:1, textAlign:'center', maxWidth:800, margin:'0 auto'}}>
          <h1 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:'clamp(38px,5.5vw,66px)', lineHeight:1.06, letterSpacing:'-0.02em', color:'white', marginBottom:24}}>
            The market doesn't need<br />more resumes.{' '}
            <span style={{color:'rgba(255,255,255,0.45)'}}>It needs proof.</span>
          </h1>

          <p style={{fontSize:18, color:'rgba(255,255,255,0.75)', lineHeight:1.7, marginBottom:40, maxWidth:520, margin:'0 auto 40px'}}>
            ASSAY scores your professional depth, not keywords, not titles, not years.
            What you actually did, how you thought, and whether it mattered.
          </p>

          <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:16}}>
            <Link to="/register" style={{
              background:'#f59e0b', color:'#1a0a00',
              padding:'14px 32px', borderRadius:10,
              fontWeight:600, fontSize:15, textDecoration:'none',
              transition:'all 0.2s',
              boxShadow:'0 0 40px rgba(245,158,11,0.3)',
            }}
              onMouseEnter={e => { e.target.style.background='#d97706'; e.target.style.transform='scale(1.02)' }}
              onMouseLeave={e => { e.target.style.background='#f59e0b'; e.target.style.transform='scale(1)' }}
            >
              Analyze your resume →
            </Link>
            <Link to="/login" style={{fontSize:14, color:'rgba(255,255,255,0.65)', textDecoration:'none'}}>Sign in</Link>
          </div>
        </div>
      </section>

      {/* ── Score card hero ─────────────────────── */}
      <section style={{maxWidth:900, margin:'0 auto', padding:'0 24px 80px'}}>
        <AnimateIn>
          <div style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:24, overflow:'hidden', boxShadow:'0 0 0 1px rgba(245,158,11,0.1), 0 40px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'}}>
            <div style={{padding:'36px 40px 28px', background:'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 60%)', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24}}>
                <div>
                  <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#f59e0b', letterSpacing:'0.1em', marginBottom:8}}>DEPTH SCORE</p>
                  <AnimatedScore />
                </div>
                <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:500, background:'rgba(245,158,11,0.15)', color:'#fcd34d', border:'1px solid rgba(245,158,11,0.3)', padding:'6px 14px', borderRadius:100}}>Proficient</span>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:10}}>
                {RUBRIC.map((d, i) => (
                  <div key={d.name} style={{display:'flex', alignItems:'center', gap:16}}>
                    <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.65)', width:180, flexShrink:0}}>{d.name}</p>
                    <div style={{flex:1, background:'rgba(255,255,255,0.06)', borderRadius:100, height:6, overflow:'hidden'}}>
                      <div style={{height:6, borderRadius:100, background:'linear-gradient(90deg,#d97706,#fcd34d)', width:`${(d.score/3)*100}%`, animation:`slideRight 0.9s ${0.3+i*0.12}s cubic-bezier(0.4,0,0.2,1) both`}} />
                    </div>
                    <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(245,158,11,0.7)', width:24, textAlign:'right', flexShrink:0}}>{d.score}/3</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:'24px 40px'}}>
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.6)', letterSpacing:'0.08em', marginBottom:12}}>POSITIONING</p>
              <p style={{fontSize:14, color:'rgba(255,255,255,0.7)', lineHeight:1.7}}>
                "This profile demonstrates genuine depth. The onboarding redesign stands out — a specific problem, a deliberate decision, and a measurable outcome. Lead with that."
              </p>
            </div>
          </div>
        </AnimateIn>
      </section>

      {/* ── Marquee ─────────────────────────────── */}
      <div style={{borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 0', overflow:'hidden', background:'rgba(255,255,255,0.03)'}}>
        <div style={{display:'flex', gap:40, whiteSpace:'nowrap', animation:'marquee 35s linear infinite'}}>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', gap:12}}>
              <span style={{width:4, height:4, borderRadius:'50%', background:'#f59e0b', display:'inline-block', flexShrink:0}} />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── How it works ────────────────────────── */}
      <section style={{maxWidth:1100, margin:'0 auto', padding:'100px 24px', position:'relative'}}>
        <AnimateIn>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#f59e0b', letterSpacing:'0.1em', marginBottom:16}}>HOW IT WORKS</p>
          <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:'clamp(28px,3.5vw,44px)', color:'white', marginBottom:16, lineHeight:1.1}}>
            Three steps to knowing<br />where you stand.
          </h2>
          <p style={{fontSize:16, color:'rgba(255,255,255,0.65)', marginBottom:64, maxWidth:460}}>
            Upload. Score. Improve. Works for every career type, on its own terms.
          </p>
        </AnimateIn>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2}}>
          {[
            { n:'01', title:'Upload your resume', body:'PDF in. ASSAY reads it across all career types, not just engineering.', icon:'📄' },
            { n:'02', title:'Score in seconds', body:'The system evaluate your work against the rubric. Every career on its own terms.', icon:'⚡' },
            { n:'03', title:'Get honest positioning', body:'What to lead with, what to fix, and exactly how to rewrite it.', icon:'🎯' },
          ].map((item, i) => (
            <AnimateIn key={item.n} delay={i * 0.1}>
              <div style={{background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'32px 28px', transition:'border-color 0.2s, background 0.2s', height:'100%'}}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,158,11,0.3)'; e.currentTarget.style.background='rgba(245,158,11,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; e.currentTarget.style.background='rgba(255,255,255,0.02)' }}
              >
                <div style={{fontSize:28, marginBottom:20}}>{item.icon}</div>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#f59e0b', marginBottom:12}}>{item.n}</p>
                <h3 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:600, fontSize:16, color:'white', marginBottom:10}}>{item.title}</h3>
                <p style={{fontSize:14, color:'rgba(255,255,255,0.65)', lineHeight:1.6}}>{item.body}</p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </section>

      {/* ── Rubric ──────────────────────────────── */}
      <section style={{background:'rgba(255,255,255,0.03)', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'100px 0'}}>
        <div style={{maxWidth:1100, margin:'0 auto', padding:'0 24px'}}>
          <AnimateIn>
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#f59e0b', letterSpacing:'0.1em', marginBottom:16}}>THE RUBRIC</p>
            <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:'clamp(28px,3.5vw,44px)', color:'white', marginBottom:16, lineHeight:1.1}}>
              Four questions.<br />Every career. No exceptions.
            </h2>
            <p style={{fontSize:16, color:'rgba(255,255,255,0.65)', marginBottom:64, maxWidth:460}}>
              Works for engineers, CSMs, marketers, operators, sellers — any professional, same rubric.
            </p>
          </AnimateIn>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            {[
              { icon:'🎯', name:'Problem Framing', q:'Did you know why it mattered?', bad:'"Managed customer onboarding"', good:'"Identified 3-day bottleneck at step 2 — redesigned workflow, cut time-to-active by 30% across 120 accounts"' },
              { icon:'🧭', name:'Approach & Decisions', q:'Did you think before acting?', bad:'"Used HubSpot for CRM"', good:'"Chose HubSpot over Salesforce — lighter config cut admin overhead by 60% for the 3-person team"' },
              { icon:'🔄', name:'Adaptability & Learning', q:'Did you adapt when it failed?', bad:'"Successfully completed all initiatives"', good:'"First playbook cut churn 8% — rebuilt with usage triggers, reaching 23% reduction"' },
              { icon:'📈', name:'Impact & Outcomes', q:'Did it change anything measurable?', bad:'"Handled 50+ accounts"', good:'"Grew NRR from 94% to 108% across 47 enterprise accounts over 6 months"' },
            ].map((item, i) => (
              <AnimateIn key={item.name} delay={i * 0.08}>
                <div style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:'24px', transition:'all 0.2s'}}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,158,11,0.25)'; e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 12px 40px rgba(245,158,11,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none' }}
                >
                  <div style={{marginBottom:6, display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:16}}>{item.icon}</span>
                    <h3 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:600, fontSize:14, color:'white'}}>{item.name}</h3>
                  </div>
                  <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.7)', marginBottom:16, paddingLeft:24}}>{item.q}</p>
                  <div style={{borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{display:'flex', gap:10, padding:'10px 14px', background:'rgba(239,68,68,0.08)'}}>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(239,68,68,0.7)', flexShrink:0}}>✗</span>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.7)', lineHeight:1.5}}>{item.bad}</span>
                    </div>
                    <div style={{display:'flex', gap:10, padding:'10px 14px', background:'rgba(245,158,11,0.06)'}}>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#f59e0b', flexShrink:0}}>✓</span>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#fcd34d', lineHeight:1.5}}>{item.good}</span>
                    </div>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────── */}
      <section style={{maxWidth:1100, margin:'0 auto', padding:'100px 24px', position:'relative'}}>
        <AnimateIn>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2}}>
            {[
              {stat:'47', label:'career types supported'},
              {stat:'4',  label:'universal dimensions'},
              {stat:'∞',  label:'resume versions tracked'},
            ].map((item) => (
              <div key={item.stat} style={{textAlign:'center', padding:'48px 24px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16}}>
                <p style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:56, color:'#f59e0b', lineHeight:1, marginBottom:12}}>{item.stat}</p>
                <p style={{fontSize:14, color:'rgba(255,255,255,0.6)'}}>{item.label}</p>
              </div>
            ))}
          </div>
        </AnimateIn>
      </section>

      {/* ── CTA ─────────────────────────────────── */}
      <section style={{maxWidth:1100, margin:'0 auto', padding:'0 24px 100px'}}>
        <AnimateIn>
          <div style={{borderRadius:28, padding:'72px 64px', background:'linear-gradient(135deg, #1e1030 0%, #3b0764 50%, #5b21b6 100%)', border:'1px solid rgba(124,58,237,0.4)', position:'relative', overflow:'hidden', display:'flex', alignItems:'flex-end', justifyContent:'space-between', boxShadow:'0 0 80px rgba(124,58,237,0.2)'}}>
            <div style={{position:'absolute', width:400, height:400, borderRadius:'50%', background:'rgba(124,58,237,0.15)', top:-150, right:-100, pointerEvents:'none'}} />
            <div style={{position:'absolute', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)', bottom:-80, left:100, pointerEvents:'none'}} />
            <div style={{position:'relative', zIndex:1}}>
              <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:'clamp(28px,3.5vw,48px)', color:'white', marginBottom:28, lineHeight:1.1}}>
                Don't claim it.<br />
                <span style={{color:'rgba(196,181,253,0.6)'}}>Prove it.</span>
              </h2>
              <Link to="/register" style={{display:'inline-flex', alignItems:'center', gap:8, background:'#f59e0b', color:'#1a0a00', padding:'14px 28px', borderRadius:10, fontWeight:600, fontSize:15, textDecoration:'none', transition:'all 0.2s', boxShadow:'0 0 30px rgba(245,158,11,0.3)'}}
                onMouseEnter={e => { e.target.style.background='#d97706'; e.target.style.transform='scale(1.02)' }}
                onMouseLeave={e => { e.target.style.background='#f59e0b'; e.target.style.transform='scale(1)' }}
              >
                Start free — no card needed →
              </Link>
            </div>
            <div style={{position:'relative', zIndex:1, textAlign:'right'}}>
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'rgba(196,181,253,0.8)'}}>ASSAY</p>
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(196,181,253,0.6)', marginTop:4}}>depth over credentials</p>
            </div>
          </div>
        </AnimateIn>
      </section>

      <footer style={{borderTop:'1px solid rgba(255,255,255,0.06)', padding:'24px 0'}}>
        <div style={{maxWidth:1100, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)'}}>ASSAY © 2025</p>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.4)'}}>talent intelligence</p>
        </div>
      </footer>
    </div>
  )
}