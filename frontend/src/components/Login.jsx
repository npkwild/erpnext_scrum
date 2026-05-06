import React, { useState } from 'react'
import { get, post } from '../utils/api'
import { LogIn, Loader2, Lock, User } from 'lucide-react'

export default function Login({ onLoginSuccess }) {
  const [usr, setUsr] = useState('')
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Core Frappe Login (Session-based)
      await post('/api/method/login', { usr, pwd })
      
      // 2. Fetch API Keys for this user
      const res = await get('/api/method/erpnext_scrum.erpnext_scrum.api.get_my_api_keys')
      const { api_key, api_secret, username } = res.message

      const token = `${api_key}:${api_secret}`
      localStorage.setItem('frappe_token', token)
      localStorage.setItem('frappe_user', username)
      
      onLoginSuccess(token)
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)] p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Logo / Title Area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-xl shadow-blue-900/20">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Daily Scrum</h1>
          <p className="text-[var(--text-secondary)] mt-2">Enter your Frappe credentials to continue</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-2xl shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-[var(--text-secondary)]" />
                </div>
                <input
                  type="text"
                  required
                  value={usr}
                  onChange={(e) => setUsr(e.target.value)}
                  className="block w-full pl-10 bg-gray-50 border border-[var(--border-color)] rounded-xl py-3 text-sm text-[var(--text-primary)] placeholder-gray-400 focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] outline-none transition-all shadow-sm"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-[var(--text-secondary)]" />
                </div>
                <input
                  type="password"
                  required
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  className="block w-full pl-10 bg-gray-50 border border-[var(--border-color)] rounded-xl py-3 text-sm text-[var(--text-primary)] placeholder-gray-400 focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] outline-none transition-all shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-400 text-xs bg-red-900/10 border border-red-900/50 p-3 rounded-lg">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent-color)] hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-8">
          &copy; {new Date().getFullYear()} ERPNext Scrum App
        </p>
      </div>
    </div>
  )
}

function AlertCircle(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
