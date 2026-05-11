import Navbar from './Navbar'

export default function AppLayout({ children, maxWidth = '1100px' }) {
  return (
    <div style={{background:'#160d1e', minHeight:'100vh', color:'white', position:'relative'}}>
      {/* Warm atmosphere — fixed behind everything */}
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
        <main style={{maxWidth, margin:'0 auto', padding:'48px 32px'}}>
          {children}
        </main>
      </div>
    </div>
  )
}