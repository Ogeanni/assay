import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: BASE_URL,
})

// Attach token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth
export const register = (data) => api.post('/auth/register', data)
export const login = (data) => api.post('/auth/login', data)
export const getMe = () => api.get('/auth/me')
export const completeOnboarding = () => api.post('/auth/onboarding-complete')


// Resume
export const analyzeResume = (formData) =>
  api.post('/resume/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const getReport = (reportId) => api.get(`/report/${reportId}`)


export const searchJobs = (role, location, page = 1) =>
  api.get('/jobs/search', { params: { role, location, page } })


export const getReportHistory = () => api.get('/report/history')

// SSE streaming — not axios, uses native EventSource
export const streamReport = (resumeId, targetRole, token) => {
  const url = `${BASE_URL}/report/stream?resume_id=${resumeId}&target_role=${encodeURIComponent(targetRole)}`
  return new EventSource(url, {
    withCredentials: false,
  })
}


export default api

