import { useState, useEffect } from 'react'
import Navbar from './Navbar'

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

export default function AppLayout({ children, maxWidth = '1100px' }) {
  const width = useWindowWidth()
  const isMobile = width < 768

  return (
    <div style={{background:'#160d1e', minHeight:'100vh', color:'white', position:'relative'}}>
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        background:'radial-gradient(ellipse 120% 60% at 85% 95%, rgba(180,53,9,0.14) 0%, transparent 60%)',
      }} />
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        background:'radial-gradient(ellipse 80% 50% at 10% 5%, rgba(88,28,135,0.16) 0%, transparent 55%)',
      }} />

      <div style={{position:'relative', zIndex:1}}>
        <Navbar dark />
        <main style={{
          maxWidth,
          margin:'0 auto',
          padding: isMobile ? '28px 16px' : '48px 32px',
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}