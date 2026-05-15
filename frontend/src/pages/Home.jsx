import React from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Users, LogOut, Code } from 'lucide-react'

export default function Home({ onLogout }) {
  return (
    <div className="min-h-screen bg-[var(--bg-color)] flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-[var(--border-color)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Code className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
              Faircode Scrum
            </h1>
          </div>
          <button 
            onClick={onLogout}
            className="p-2.5 text-[var(--text-secondary)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 flex flex-col items-center justify-center">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-4">
            Welcome to <span className="text-blue-600">Workspace</span>
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Select an application to get started. Manage your daily scrum or view comprehensive department analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <Link 
            to="/scrum" 
            className="group relative bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-300">
                <Users className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Daily Scrum</h3>
              <p className="text-gray-500">
                Record your daily updates, log timesheets, and manage tasks for the team.
              </p>
            </div>
          </Link>

          <Link 
            to="/dashboard" 
            className="group relative bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-xl hover:indigo-300 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-300">
                <LayoutDashboard className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Admin Dashboard</h3>
              <p className="text-gray-500">
                View comprehensive reports, employee status, timesheet stats, and metrics.
              </p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
