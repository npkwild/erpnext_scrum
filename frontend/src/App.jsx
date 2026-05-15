import React, { useEffect, useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import ScrumBoard from './components/ScrumBoard'
import Login from './components/Login'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'

// Configure Axios
axios.defaults.withCredentials = true

function getCookie(name) {
  let r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
  return r ? r[1] : undefined;
}

axios.interceptors.request.use(function (config) {
  const token = localStorage.getItem('frappe_token')
  if (token) {
    config.headers['Authorization'] = `token ${token}`
  }
  const csrf_token = getCookie('frappe_csrf_token')
  if (csrf_token) {
    config.headers['X-Frappe-CSRF-Token'] = csrf_token
  }
  return config
}, function (error) {
  return Promise.reject(error)
})

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
    <Router>
      <div className="min-h-screen bg-[var(--bg-color)]">
        <Routes>
          <Route path="/" element={<Home onLogout={handleLogout} />} />
          <Route path="/scrum" element={<ScrumBoard onLogout={handleLogout} />} />
          <Route path="/dashboard" element={<Dashboard onLogout={handleLogout} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
