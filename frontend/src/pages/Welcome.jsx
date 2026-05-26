import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { completeOnboarding } from '../api/client'

const STEPS = [
  {
    label: '01 — what we measure',
    title: 'Depth, not keywords.',
    sub: 'ASSAY scores how deeply you describe your work — not how well you match a keyword list.',
  },
  {
    label: '02 — what scores well',
    title: 'Specifics beat vague.',
    sub: 'The difference between a 41 and a 78 is usually one sentence.',
  },
  {
    label: '03 — your report',
    title: "Here's what you'll get.",
    sub: 'A depth score, specific gaps, and a rewrite example for every weak signal.',
  },
]

const DIMENSIONS = [
  { icon: '🎯', name: 'Problem Framing',         desc: 'Did you know why it mattered?' },
  { icon: '🧭', name: 'Approach & Decisions',    desc: 'Did you think before acting?' },
  { icon: '🔄', name: 'Adaptability & Learning', desc: 'Did you adapt when it failed?' },
  { icon: '📈', name: 'Impact & Outcomes',        desc: 'Did it change anything measurable?' },
]

const EXAMPLES = [
  {
    bad:  '"Managed customer onboarding"',
    good: '"Redesigned onboarding workflow reducing time-to-active by 30% across 120 enterprise accounts"',
  },
  {
    bad:  '"Built a price prediction model using XGBoost"',
    good: '"Chose XGBoost over neural nets for interpretability — R²=0.96, cut manual repricing time by 6h/day"',
  },
]

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


function ProgressDots({ current }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-10">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 6,
            background: i === current ? 'var(--purple)' : i < current ? '#c4b5fd' : '#e4e4e7',
          }}
        />
      ))}
    </div>
  )
}

export default function Welcome() {
  const [step, setStep] = useState(0)
  const { user, saveToken } = useAuth()
  const navigate = useNavigate()

  const finish = async (destination) => {
    try {
      await completeOnboarding()
    } catch (_) {}
    navigate(destination)
  }

  return (
    <div className="min-h-screen bg-[#fafafa] grain flex flex-col">
      {/* Minimal nav */}
      <nav className="border-b border-zinc-100 bg-white/80 backdrop-blur-sm px-6 h-14 flex items-center justify-between">
        <span className="font-display text-sm font-bold tracking-tight text-black flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{background:'var(--purple)'}}>
            <span className="text-white font-mono text-xs font-bold">A</span>
          </span>
          ASSAY
        </span>
        <button
          onClick={() => finish('/analyze')}
          className="font-mono text-xs text-zinc-300 hover:text-black transition-colors"
        >
          Skip →
        </button>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <ProgressDots current={step} />

          {/* Step 0 — What we measure */}
          {step === 0 && (
            <div className="fade-up">
              <p className="font-mono text-xs mb-3" style={{color:'var(--purple)'}}>{STEPS[0].label}</p>
              <h1 className="font-display text-4xl font-bold text-black tracking-tight mb-3">
                {STEPS[0].title}
              </h1>
              <p className="text-zinc-500 text-base mb-8 leading-relaxed">{STEPS[0].sub}</p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {DIMENSIONS.map((d) => (
                  <div
                    key={d.name}
                    className="bg-white border border-zinc-100 rounded-xl p-5 hover:border-zinc-200 transition-all hover:-translate-y-0.5"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base mb-3"
                      style={{background:'#faf5ff'}}
                    >
                      {d.icon}
                    </div>
                    <p className="text-sm font-semibold text-black mb-1">{d.name}</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">{d.desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-lg text-sm font-medium text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{background:'var(--purple)'}}
              >
                Got it — show me an example →
              </button>
            </div>
          )}

          {/* Step 1 — What scores well */}
          {step === 1 && (
            <div className="fade-up">
              <p className="font-mono text-xs mb-3" style={{color:'var(--purple)'}}>{STEPS[1].label}</p>
              <h1 className="font-display text-4xl font-bold text-black tracking-tight mb-3">
                {STEPS[1].title}
              </h1>
              <p className="text-zinc-500 text-base mb-8 leading-relaxed">{STEPS[1].sub}</p>

              <div className="space-y-3 mb-8">
                {EXAMPLES.map((ex, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-zinc-100">
                    <div className="flex items-start gap-3 px-4 py-3 bg-red-50">
                      <span className="font-mono text-xs text-red-400 shrink-0 mt-0.5">✗</span>
                      <span className="font-mono text-xs text-zinc-500 leading-relaxed">{ex.bad}</span>
                    </div>
                    <div className="flex items-start gap-3 px-4 py-3" style={{background:'#faf5ff'}}>
                      <span className="font-mono text-xs shrink-0 mt-0.5" style={{color:'var(--purple)'}}>✓</span>
                      <span className="font-mono text-xs leading-relaxed" style={{color:'var(--purple-text)'}}>{ex.good}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3 rounded-lg text-sm font-medium text-white transition-all hover:scale-[1.01]"
                  style={{background:'var(--purple)'}}
                >
                  My resume is ready →
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="w-full py-3 rounded-lg text-sm text-zinc-500 border border-zinc-200 bg-white hover:border-zinc-300 transition-all"
                >
                  I'll improve it after the analysis
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Score preview */}
          {step === 2 && (
            <div className="fade-up">
              <p className="font-mono text-xs mb-3" style={{color:'var(--purple)'}}>{STEPS[2].label}</p>
              <h1 className="font-display text-4xl font-bold text-black tracking-tight mb-3">
                {STEPS[2].title}
              </h1>
              <p className="text-zinc-500 text-base mb-8 leading-relaxed">{STEPS[2].sub}</p>

              {/* Score preview card */}
              <div className="bg-white border border-zinc-100 rounded-2xl p-6 mb-8" style={{boxShadow:'0 0 0 1px #ede9fe'}}>
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest mb-2" style={{color:'var(--purple)'}}>Depth Score</p>
                    <div className="flex items-end gap-1">
                      <span className="font-display text-5xl font-bold leading-none" style={{color:'var(--purple-dark)'}}>70</span>
                      <span className="font-mono text-lg mb-1" style={{color:'#c4b5fd'}}>/100</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs px-3 py-1.5 rounded-full text-white" style={{background:'var(--purple)'}}>
                    Proficient
                  </span>
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'Problem Framing',         score: 3 },
                    { label: 'Approach & Decisions',    score: 2 },
                    { label: 'Adaptability & Learning', score: 1 },
                    { label: 'Impact & Outcomes',       score: 3 },
                  ].map((d) => (
                    <div key={d.label} className="flex items-center gap-3">
                      <p className="text-xs text-zinc-500 w-44 shrink-0">{d.label}</p>
                      <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{background:'#ede9fe'}}>
                        <div
                          className="h-1.5 rounded-full"
                          style={{width:`${(d.score/3)*100}%`, background:'var(--purple)'}}
                        />
                      </div>
                      <p className="font-mono text-xs w-6 text-right shrink-0" style={{color:'var(--purple-mid)'}}>
                        {d.score}/3
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-5 border-t border-zinc-50">
                  <p className="font-mono text-xs text-zinc-400 mb-2 uppercase tracking-wider">Example feedback</p>
                  <div className="rounded-lg overflow-hidden border border-zinc-100 text-xs">
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border-b border-zinc-100">
                      <span className="text-red-400 font-mono shrink-0">✗</span>
                      <span className="font-mono text-zinc-500">Managed onboarding workflows</span>
                    </div>
                    <div className="flex items-start gap-2 px-3 py-2.5" style={{background:'#faf5ff'}}>
                      <span className="font-mono shrink-0" style={{color:'var(--purple)'}}>✓</span>
                      <span className="font-mono" style={{color:'var(--purple-text)'}}>Redesigned onboarding after identifying 3-day bottleneck — cut time-to-active by 30%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => finish('/analyze')}
                  className="w-full py-3 rounded-lg text-sm font-medium text-white transition-all hover:scale-[1.01]"
                  style={{background:'var(--purple)'}}
                >
                  Analyze my resume →
                </button>
                <button
                  onClick={() => finish('/jobs')}
                  className="w-full py-3 rounded-lg text-sm text-zinc-500 border border-zinc-200 bg-white hover:border-zinc-300 transition-all"
                >
                  Browse jobs first
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}