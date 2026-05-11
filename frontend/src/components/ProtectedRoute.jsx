import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div style={{minHeight:'100vh', background:'#160d1e', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{width:24, height:24, borderRadius:'50%', border:'2px solid rgba(124,58,237,0.3)', borderTopColor:'#a78bfa', animation:'spin 0.8s linear infinite'}} />
      </div>
    )
  }

  if (!token) return <Navigate to="/login" replace />
  return children
}