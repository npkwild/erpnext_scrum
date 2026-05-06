import React, { useEffect, useState } from 'react'
import axios from 'axios'
import ScrumBoard from './components/ScrumBoard'
import Login from './components/Login'

// Configure Axios
axios.defaults.withCredentials = true // Allow cookies for the login phase

// Helper to get CSRF token from cookies
function getCookie(name) {
  let r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
  return r ? r[1] : undefined;
}

// Global Interceptor to attach tokens
axios.interceptors.request.use(function (config) {
  const token = localStorage.getItem('frappe_token')
  if (token) {
    config.headers['Authorization'] = `token ${token}`
  }

  // Always attach CSRF token from cookie if available.
  // In a browser on the same origin, the sid cookie is always sent,
  // so Frappe will always require a matching X-Frappe-CSRF-Token.
  const csrf_token = getCookie('frappe_csrf_token')
  if (csrf_token) {
    config.headers['X-Frappe-CSRF-Token'] = csrf_token
  }

  return config
}, function (error) {
  return Promise.reject(error)
})

// Handle Unauthorized responses
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('frappe_token')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

function App() {
  const [token, setToken] = useState(localStorage.getItem('frappe_token'))

  const handleLoginSuccess = (newToken) => {
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('frappe_token')
    localStorage.removeItem('frappe_user')
    setToken(null)
  }

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="min-h-screen bg-[var(--bg-color)]">
      <ScrumBoard onLogout={handleLogout} />
    </div>
  )
}

export default App
