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
      transform: inView ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.7s ${delay}s ease, transform 0.7s ${delay}s ease`,
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
    <div ref={ref}>
      <span style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:64, fontWeight:800, color:'#7c3aed', lineHeight:1, fontVariantNumeric:'tabular-nums'}}>
        {count}
      </span>
      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:18, color:'#a78bfa', marginLeft:4}}>/100</span>
    </div>
  )
}

const DiamondLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="24" height="24">
    <defs>
      <linearGradient id="dg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7c3aed"/>
        <stop offset="100%" stopColor="#f59e0b"/>
      </linearGradient>
      <linearGradient id="dg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a78bfa"/>
        <stop offset="100%" stopColor="#fcd34d"/>
      </linearGradient>
    </defs>
    <polygon points="22,1 43,22 22,43 1,22" fill="none" stroke="url(#dg1)" strokeWidth="2.5"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="url(#dg1)" fillOpacity="0.35"/>
    <polygon points="22,10 34,22 22,34 10,22" fill="none" stroke="url(#dg2)" strokeWidth="1.5"/>
    <circle cx="22" cy="22" r="5" fill="url(#dg1)"/>
  </svg>
)

export default function Landing() {
  const [heroLoaded, setHeroLoaded] = useState(false)
  useEffect(() => { setTimeout(() => setHeroLoaded(true), 100) }, [])

  return (
    <div style={{background:'#f0eef8', minHeight:'100vh', color:'#0f0a1e'}}>

      <style>{`
        @keyframes meshShift {
          0% { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: scale(1.06) rotate(1.5deg); opacity: 0.85; }
        }
        @keyframes float1 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(32px,22px) scale(1.1); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-22px,-28px) scale(0.9); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0,0); }
          50% { transform: translate(-14px,18px); }
        }
        @keyframes float4 {
          0%, 100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(12px,-14px) scale(1.06); }
          66% { transform: translate(-8px,10px) scale(0.95); }
        }
        @keyframes cardBob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes badgePulse {
          0%, 100% { opacity:1; transform:scale(1); }
          50% { opacity:0.55; transform:scale(0.75); }
        }
        @keyframes btnGlow {
          0%, 100% { box-shadow: 0 4px 20px rgba(245,158,11,0.35); }
          50% { box-shadow: 0 4px 32px rgba(245,158,11,0.6); }
        }
        @keyframes slideIn {
          from { opacity:0; transform:translateY(22px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes slideRight { from { width:0 } }
        @keyframes marquee { from { transform:translateX(0) } to { transform:translateX(-50%) } }
        @keyframes spin { to { transform:rotate(360deg) } }
        .hero-badge { animation: slideIn 0.7s 0.1s ease both; }
        .hero-h1    { animation: slideIn 0.7s 0.25s ease both; }
        .hero-sub   { animation: slideIn 0.7s 0.4s ease both; }
        .hero-cta   { animation: slideIn 0.7s 0.55s ease both; }
        .hero-trust { animation: slideIn 0.7s 0.7s ease both; }
        .card-a { animation: cardBob 6s ease-in-out infinite; }
        .card-b { animation: cardBob 8s 1.2s ease-in-out infinite; }
        .card-c { animation: cardBob 7s 2.5s ease-in-out infinite; }
        .btn-amber:hover { background:#d97706!important; transform:translateY(-2px); }
        .nav-link:hover { color:#0f0a1e!important; }
        .how-card:hover { transform:translateY(-6px)!important; }
        .rubric-card:hover { transform:translateY(-4px)!important; }
      `}</style>

      {/* ── Navbar ─────────────────────────────── */}
      <nav style={{
        borderBottom:'1px solid rgba(124,58,237,0.1)',
        background:'rgba(240,238,248,0.92)',
        backdropFilter:'blur(12px)',
        position:'sticky', top:0, zIndex:50,
      }}>
        <div style={{maxWidth:1100, margin:'0 auto', padding:'0 24px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <Link to="/" style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:15, fontWeight:700, color:'#0f0a1e', textDecoration:'none', display:'flex', alignItems:'center', gap:10}}>
            <DiamondLogo />
            ASSAY
          </Link>
          <div style={{display:'flex', alignItems:'center', gap:28}}>
            <Link to="/login" className="nav-link" style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#6b7280', textDecoration:'none', transition:'color 0.2s'}}>Sign in</Link>
            <Link to="/register" className="btn-amber" style={{
              fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:600,
              background:'#f59e0b', color:'#1a0a00', padding:'9px 20px',
              borderRadius:8, textDecoration:'none', transition:'all 0.2s',
              boxShadow:'0 2px 8px rgba(245,158,11,0.3)',
              animation:'btnGlow 3s ease-in-out infinite',
            }}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────── */}
      <section style={{maxWidth:1100, margin:'0 auto', padding:'80px 24px 60px', position:'relative', overflow:'hidden'}}>

        {/* Mesh gradient */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          background:`
            radial-gradient(ellipse 65% 55% at 8% 15%, rgba(124,58,237,0.13) 0%, transparent 60%),
            radial-gradient(ellipse 55% 65% at 92% 85%, rgba(245,158,11,0.11) 0%, transparent 60%),
            radial-gradient(ellipse 45% 45% at 50% 50%, rgba(167,139,250,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 82% 12%, rgba(252,211,77,0.08) 0%, transparent 60%)
          `,
          animation:'meshShift 12s ease-in-out infinite alternate',
        }} />

        {/* Dot grid */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:'radial-gradient(circle, rgba(124,58,237,0.14) 1px, transparent 1px)',
          backgroundSize:'28px 28px', opacity:0.45,
        }} />

        {/* Floating orbs */}
        <div style={{position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', filter:'blur(45px)', top:-80, left:-60, pointerEvents:'none', animation:'float1 8s ease-in-out infinite'}} />
        <div style={{position:'absolute', width:240, height:240, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 70%)', filter:'blur(40px)', bottom:-60, right:-40, pointerEvents:'none', animation:'float2 10s ease-in-out infinite'}} />
        <div style={{position:'absolute', width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle, rgba(167,139,250,0.13) 0%, transparent 70%)', filter:'blur(35px)', top:'40%', right:'8%', pointerEvents:'none', animation:'float3 7s ease-in-out infinite'}} />
        <div style={{position:'absolute', width:130, height:130, borderRadius:'50%', background:'radial-gradient(circle, rgba(252,211,77,0.13) 0%, transparent 70%)', filter:'blur(30px)', top:'12%', left:'38%', pointerEvents:'none', animation:'float4 9s ease-in-out infinite'}} />



        {/* Hero text — left column */}
        <div style={{position:'relative', zIndex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:60, alignItems:'center'}}>
          <div>
            

            <h1 className="hero-h1" style={{
              fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800,
              fontSize:'clamp(34px,3.8vw,52px)',
              lineHeight:1.08, letterSpacing:'-0.02em',
              color:'#0f0a1e', marginBottom:20,
            }}>
              The market doesn't need more resumes.{' '}
              <span style={{
                background:'linear-gradient(135deg, #7c3aed 0%, #f59e0b 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                backgroundClip:'text',
              }}>
                It needs proof.
              </span>
            </h1>

            <p className="hero-sub" style={{fontSize:17, color:'#4b5563', lineHeight:1.75, marginBottom:36, maxWidth:460}}>
              ASSAY scores your professional depth, not keywords, not titles, not years.
              What you actually did, how you thought, and whether it mattered.
            </p>

            <div className="hero-cta" style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
              <Link to="/register" className="btn-amber" style={{
                background:'#f59e0b', color:'#1a0a00',
                padding:'14px 32px', borderRadius:10,
                fontWeight:700, fontSize:15, textDecoration:'none',
                transition:'all 0.2s',
                animation:'btnGlow 3s ease-in-out infinite',
              }}>
                Analyze your resume →
              </Link>
              <Link to="/login" className="nav-link" style={{fontSize:14, color:'#6b7280', textDecoration:'none', transition:'color 0.2s'}}>
                Sign in
              </Link>
            </div>

            <div className="hero-trust" style={{display:'flex', alignItems:'center', gap:20, marginTop:28, flexWrap:'wrap'}}>
              {['47 career types', 'Free to start', 'No card needed'].map((t, i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:6}}>
                  <span style={{width:16, height:16, borderRadius:'50%', background:'rgba(124,58,237,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#7c3aed'}}>✓</span>
                  <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#6b7280'}}>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — product screenshot */}
          <div style={{position:'relative'}}>
            <div style={{
              position:'absolute', inset:-2, borderRadius:20,
              background:'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(245,158,11,0.15) 100%)',
              filter:'blur(16px)', zIndex:0,
            }} />
            <div style={{
              position:'relative', zIndex:1, borderRadius:16, overflow:'hidden',
              border:'1px solid rgba(124,58,237,0.15)',
              boxShadow:'0 24px 60px rgba(15,10,30,0.12), 0 4px 16px rgba(124,58,237,0.08)',
              transition:'transform 0.3s ease',
            }}
              onMouseEnter={e => e.currentTarget.style.transform='translateY(-6px)'}
              onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
            >
              <img src="/card.png" alt="ASSAY depth score report" style={{width:'100%', display:'block', borderRadius:12}}
                onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}
              />
              {/* Fallback */}
              <div style={{display:'none', background:'#160d1e', minHeight:320, borderRadius:12, alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, padding:32}}>
                <div style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.1em'}}>DEPTH SCORE</div>
                <div style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:64, fontWeight:800, color:'#a78bfa', lineHeight:1}}>83</div>
                <div style={{fontFamily:'JetBrains Mono,monospace', fontSize:13, color:'rgba(255,255,255,0.4)'}}>/100 · Proficient</div>
                <div style={{marginTop:12, width:'100%', display:'flex', flexDirection:'column', gap:8}}>
                  {['Problem Framing','Approach & Decisions','Adaptability','Impact & Outcomes'].map((d,i) => (
                    <div key={d} style={{display:'flex', alignItems:'center', gap:12}}>
                      <div style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.4)', width:120, flexShrink:0}}>{d}</div>
                      <div style={{flex:1, background:'rgba(255,255,255,0.08)', borderRadius:100, height:5}}>
                        <div style={{height:5, borderRadius:100, background:'linear-gradient(90deg,#7c3aed,#a78bfa)', width:`${[100,100,67,100][i]}%`}} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Badge below image */}
            <div style={{
              position:'absolute', bottom:-16, left:-16, zIndex:2,
              background:'white', borderRadius:12, padding:'10px 16px',
              boxShadow:'0 8px 24px rgba(15,10,30,0.12)', border:'1px solid rgba(124,58,237,0.1)',
              display:'flex', alignItems:'center', gap:10,
            }}>
              <span style={{fontSize:18}}>⚡</span>
              <div>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#7c3aed', marginBottom:2}}>DEPTH SCORE</p>
                <p style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:15, fontWeight:700, color:'#0f0a1e'}}>83/100 · Proficient</p>
              </div>
            </div>

            {/* Score card top-right */}
            <div className="card-a" style={{position:'absolute', top:-18, right:-18, zIndex:3, background:'white', borderRadius:12, padding:'10px 16px', boxShadow:'0 6px 24px rgba(15,10,30,0.1)', border:'1px solid rgba(124,58,237,0.12)'}}>
              <div style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#a78bfa', marginBottom:4}}>DEPTH SCORE</div>
              <div style={{display:'flex', alignItems:'baseline', gap:4}}>
                <span style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:22, fontWeight:800, color:'#7c3aed'}}>83</span>
                <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#a78bfa'}}>/100</span>
              </div>
            </div>

            {/* Rewritten bullet — bottom right */}
            <div className="card-b" style={{position:'absolute', bottom:40, right:-20, zIndex:3, background:'white', borderRadius:12, padding:'10px 16px', boxShadow:'0 6px 24px rgba(15,10,30,0.1)', border:'1px solid rgba(245,158,11,0.2)'}}>
              <div style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#f59e0b', marginBottom:4}}>REWRITTEN BULLET</div>
              <div style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#0f0a1e'}}>Ready to paste ✓</div>
            </div>

            {/* Gap card — mid right */}
            <div className="card-c" style={{position:'absolute', top:'48%', right:-24, zIndex:3, background:'white', borderRadius:12, padding:'10px 16px', boxShadow:'0 6px 24px rgba(15,10,30,0.1)', border:'1px solid rgba(124,58,237,0.12)'}}>
              <div style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#6b7280', marginBottom:4}}>GAP IDENTIFIED</div>
              <div style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#7c3aed'}}>Impact & Outcomes ↑</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquee ─────────────────────────────── */}
      <div style={{borderTop:'1px solid rgba(124,58,237,0.08)', borderBottom:'1px solid rgba(124,58,237,0.08)', padding:'14px 0', overflow:'hidden', background:'rgba(124,58,237,0.03)'}}>
        <div style={{display:'flex', gap:40, whiteSpace:'nowrap', animation:'marquee 35s linear infinite'}}>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} style={{fontFamily:'JetBrains Mono,monospace', fontSize:12, color:'#6b7280', display:'flex', alignItems:'center', gap:12}}>
              <span style={{width:4, height:4, borderRadius:'50%', background: i % 2 === 0 ? '#7c3aed' : '#f59e0b', display:'inline-block', flexShrink:0}} />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── How it works ────────────────────────── */}
      <section style={{maxWidth:1100, margin:'0 auto', padding:'100px 24px', position:'relative'}}>
        {/* Subtle bg blob */}
        <div style={{position:'absolute', top:0, right:-100, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)', filter:'blur(40px)', pointerEvents:'none'}} />

        <AnimateIn>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:16}}>
            <div style={{width:3, height:20, borderRadius:2, background:'linear-gradient(180deg, #7c3aed, #f59e0b)'}} />
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#7c3aed', letterSpacing:'0.1em'}}>HOW IT WORKS</p>
          </div>
          <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:'clamp(28px,3.5vw,44px)', color:'#0f0a1e', marginBottom:16, lineHeight:1.1}}>
            Three steps to knowing<br />where you stand.
          </h2>
          <p style={{fontSize:16, color:'#4b5563', marginBottom:64, maxWidth:460}}>
            Upload. Score. Improve. Works for every career type, on its own terms.
          </p>
        </AnimateIn>

        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16}}>
          {[
            { n:'01', title:'Upload your resume', body:'PDF in. ASSAY reads it across all career types, not just engineering.', icon:'📄', accent:'#7c3aed', glow:'rgba(124,58,237,0.08)' },
            { n:'02', title:'Score in seconds', body:'The system evaluates your work against the rubric. Every career on its own terms.', icon:'⚡', accent:'#f59e0b', glow:'rgba(245,158,11,0.06)' },
            { n:'03', title:'Get honest positioning', body:'What to lead with, what to fix, and exactly how to rewrite it.', icon:'🎯', accent:'#7c3aed', glow:'rgba(124,58,237,0.08)' },
          ].map((item, i) => (
            <AnimateIn key={item.n} delay={i * 0.1}>
              <div className="how-card" style={{
                background:'white', border:'1px solid rgba(124,58,237,0.08)',
                borderRadius:16, padding:'32px 28px',
                transition:'all 0.3s ease', height:'100%',
                boxShadow:'0 2px 12px rgba(15,10,30,0.04)',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=`${item.accent}40`; e.currentTarget.style.boxShadow=`0 16px 40px ${item.glow}, 0 2px 12px rgba(15,10,30,0.04)` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(124,58,237,0.08)'; e.currentTarget.style.boxShadow='0 2px 12px rgba(15,10,30,0.04)' }}
              >
                <div style={{width:48, height:48, borderRadius:14, background:`${item.accent}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:20}}>{item.icon}</div>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:item.accent, marginBottom:10}}>{item.n}</p>
                <h3 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:600, fontSize:17, color:'#0f0a1e', marginBottom:10}}>{item.title}</h3>
                <p style={{fontSize:14, color:'#4b5563', lineHeight:1.7}}>{item.body}</p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </section>

      {/* ── Rubric — dark section ────────────────── */}
      <section style={{background:'#0f0a1e', padding:'100px 0', position:'relative', overflow:'hidden'}}>
        <div style={{position:'absolute', top:-100, left:-100, width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', filter:'blur(60px)', pointerEvents:'none'}} />
        <div style={{position:'absolute', bottom:-100, right:-100, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', filter:'blur(60px)', pointerEvents:'none'}} />

        <div style={{maxWidth:1100, margin:'0 auto', padding:'0 24px', position:'relative', zIndex:1}}>
          <AnimateIn>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:16}}>
              <div style={{width:3, height:20, borderRadius:2, background:'linear-gradient(180deg, #a78bfa, #fcd34d)'}} />
              <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', letterSpacing:'0.1em'}}>THE RUBRIC</p>
            </div>
            <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:'clamp(28px,3.5vw,44px)', color:'white', marginBottom:16, lineHeight:1.1}}>
              Four questions.<br />
              <span style={{background:'linear-gradient(135deg, #a78bfa 0%, #fcd34d 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text'}}>
                Every career. No exceptions.
              </span>
            </h2>
            <p style={{fontSize:16, color:'rgba(255,255,255,0.55)', marginBottom:64, maxWidth:460}}>
              Works for engineers, CSMs, marketers, operators, sellers - any professional, same rubric.
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
                <div className="rubric-card" style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'24px', transition:'all 0.3s ease'}}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(167,139,250,0.3)'; e.currentTarget.style.boxShadow='0 12px 40px rgba(124,58,237,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow='none'; }}
                >
                  <div style={{marginBottom:6, display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:16}}>{item.icon}</span>
                    <h3 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:600, fontSize:14, color:'white'}}>{item.name}</h3>
                  </div>
                  <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:16, paddingLeft:24}}>{item.q}</p>
                  <div style={{borderRadius:12, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{display:'flex', gap:10, padding:'10px 14px', background:'rgba(239,68,68,0.08)'}}>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(239,68,68,0.7)', flexShrink:0}}>✗</span>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'rgba(255,255,255,0.6)', lineHeight:1.5}}>{item.bad}</span>
                    </div>
                    <div style={{display:'flex', gap:10, padding:'10px 14px', background:'rgba(124,58,237,0.1)'}}>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#a78bfa', flexShrink:0}}>✓</span>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#c4b5fd', lineHeight:1.5}}>{item.good}</span>
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
        <div style={{position:'absolute', top:0, left:-80, width:350, height:350, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)', filter:'blur(40px)', pointerEvents:'none'}} />
        <AnimateIn>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16}}>
            {[
              {stat:'47', label:'career types supported', accent:'#7c3aed'},
              {stat:'4',  label:'universal dimensions', accent:'#f59e0b'},
              {stat:'∞',  label:'resume versions tracked', accent:'#7c3aed'},
            ].map((item) => (
              <div key={item.stat} style={{
                textAlign:'center', padding:'48px 24px',
                background:'white', border:'1px solid rgba(124,58,237,0.08)',
                borderRadius:16, boxShadow:'0 2px 12px rgba(15,10,30,0.04)',
                transition:'all 0.3s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow=`0 16px 40px rgba(15,10,30,0.08)` }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 2px 12px rgba(15,10,30,0.04)' }}
              >
                <p style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:56, color:item.accent, lineHeight:1, marginBottom:12}}>{item.stat}</p>
                <p style={{fontSize:14, color:'#6b7280'}}>{item.label}</p>
              </div>
            ))}
          </div>
        </AnimateIn>
      </section>

      {/* ── CTA ─────────────────────────────────── */}
      <section style={{maxWidth:1100, margin:'0 auto', padding:'0 24px 100px'}}>
        <AnimateIn>
          <div style={{
            borderRadius:24, padding:'72px 64px',
            background:'linear-gradient(135deg, #1e1030 0%, #3b0764 60%, #1e1030 100%)',
            border:'1px solid rgba(124,58,237,0.3)',
            position:'relative', overflow:'hidden',
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:40,
          }}>
            <div style={{position:'absolute', top:-100, right:-100, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)', filter:'blur(40px)', pointerEvents:'none'}} />
            <div style={{position:'absolute', bottom:-60, left:80, width:250, height:250, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)', filter:'blur(40px)', pointerEvents:'none'}} />

            <div style={{position:'relative', zIndex:1}}>
              <h2 style={{fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:'clamp(28px,3.5vw,48px)', color:'white', marginBottom:8, lineHeight:1.1}}>
                Don't claim it.
              </h2>
              <h2 style={{
                fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:'clamp(28px,3.5vw,48px)', marginBottom:28, lineHeight:1.1,
                background:'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
              }}>
                Prove it.
              </h2>
              <Link to="/register" className="btn-amber" style={{
                display:'inline-flex', alignItems:'center', gap:8,
                background:'#f59e0b', color:'#1a0a00',
                padding:'14px 28px', borderRadius:10,
                fontWeight:700, fontSize:15, textDecoration:'none',
                transition:'all 0.2s',
                animation:'btnGlow 3s ease-in-out infinite',
              }}>
                Start free →
              </Link>
            </div>

            <div style={{position:'relative', zIndex:1, flexShrink:0}}>
              <div style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'24px 32px', minWidth:220}}>
                <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'#a78bfa', letterSpacing:'0.1em', marginBottom:8}}>YOUR SCORE</p>
                <div style={{display:'flex', alignItems:'flex-end', gap:6, marginBottom:16}}>
                  <span style={{fontFamily:'Bricolage Grotesque,sans-serif', fontSize:52, fontWeight:800, color:'#f59e0b', lineHeight:1}}>83</span>
                  <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:16, color:'rgba(245,158,11,0.5)', marginBottom:4}}>/100</span>
                </div>
                {['Problem Framing', 'Approach', 'Adaptability', 'Impact'].map((d, i) => (
                  <div key={d} style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                    <div style={{flex:1, background:'rgba(255,255,255,0.08)', borderRadius:100, height:4, overflow:'hidden'}}>
                      <div style={{height:4, borderRadius:100, background: i % 2 === 0 ? '#7c3aed' : '#f59e0b', width:`${[100,100,67,100][i]}%`}} />
                    </div>
                    <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:10, color:'rgba(255,255,255,0.4)', width:20, textAlign:'right'}}>{[3,3,2,3][i]}/3</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimateIn>
      </section>

      <footer style={{borderTop:'1px solid rgba(124,58,237,0.1)', padding:'24px 0', background:'#f0eef8'}}>
        <div style={{maxWidth:1100, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <DiamondLogo />
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#6b7280'}}>ASSAY © 2025</p>
          </div>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'#9ca3af'}}>talent intelligence</p>
        </div>
      </footer>
    </div>
  )
}