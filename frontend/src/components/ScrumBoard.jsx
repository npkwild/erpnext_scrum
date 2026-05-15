import React, { useState, useEffect, useRef } from 'react'
import { get, post } from '../utils/api'
import { Check, Send, AlertCircle, Loader2, Search, Filter, Play, Save, LogOut, X, CheckCircle, Bell, Calendar, Clock, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import ScrumRow from './ScrumRow'
import { QuickCreateModal } from './TaskSelector'

export default function ScrumBoard({ onLogout }) {
  const [data, setData] = useState({ employees: [], scrum_master_name: '', available_departments: [], projects: [] })
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState(null)
  const [scrumMeta, setScrumMeta] = useState({ name: null, status: null, docstatus: null })
  
  // Filters
  const [department, setDepartment] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  
  // Task storage for auto-save
  const [enteredTasks, setEnteredTasks] = useState({}) // { empId_rowId: { ...taskData } }
  const [modalConfig, setModalConfig] = useState(null)
  const [submitConfirmConfig, setSubmitConfirmConfig] = useState(null)
  const [bulkReminderConfig, setBulkReminderConfig] = useState(null)
  const [timesheetReminderConfig, setTimesheetReminderConfig] = useState(null)
  const autoSaveTimers = useRef({})
  const dateInputRef = useRef(null)

  useEffect(() => {
    fetchData()
  }, [date, department])

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await get(`/api/method/erpnext_scrum.erpnext_scrum.api.get_scrum_data?date=${date}&department=${department}`)
      const msg = res.message
      
      // Auto-select first department if none selected
      if (!department && msg.available_departments?.length > 0) {
          setDepartment(msg.available_departments[0])
          return
      }
      
      setData(msg)
      setScrumMeta({
        name: res.message.scrum_name,
        status: res.message.scrum_status,
        docstatus: res.message.scrum_docstatus
      })
      
      // Initialize enteredTasks from saved data
      const initialTasks = {}
      res.message.employees.forEach(emp => {
          if (emp.tasks && emp.tasks.length > 0) {
              emp.tasks.forEach((t, idx) => {
                  initialTasks[`${emp.employee}_${idx + 1}`] = {
                      ...t,
                      employee: emp.employee
                  }
              })
          }
      })
      setEnteredTasks(initialTasks)

    } catch (e) {
      console.error("Failed to fetch scrum data", e)
    }
    setLoading(false)
  }

  const startScrum = async () => {
    if (!department) {
        showNotification("Please select a department first.", "error")
        return
    }
    setStarting(true)
    try {
        await post('/api/method/erpnext_scrum.erpnext_scrum.api.start_scrum', {
            date,
            department
        })
        fetchData()
    } catch (e) {
        showNotification(e.message, "error")
    }
    setStarting(false)
  }

  const handleTaskChange = (empId, rowId, taskData) => {
    const key = `${empId}_${rowId}`
    setEnteredTasks(prev => ({
      ...prev,
      [key]: taskData
    }))

    // Auto-save logic
    if (scrumMeta.name) {
        clearTimeout(autoSaveTimers.current[key])
        autoSaveTimers.current[key] = setTimeout(() => {
            saveRow(key, taskData)
            autoSaveTimers.current[key] = null
        }, 1000)
    }
  }

  const saveRow = async (key, taskData) => {
      try {
          if (!taskData) {
              // Get the saved row name if it exists
              const existingRowName = enteredTasks[key]?.name
              if (existingRowName) {
                  await post('/api/method/erpnext_scrum.erpnext_scrum.api.remove_scrum_entry', {
                      scrum_name: scrumMeta.name,
                      row_name: existingRowName
                  })
              }
              return
          }
          
          const res = await post('/api/method/erpnext_scrum.erpnext_scrum.api.save_scrum_entry', {
              scrum_name: scrumMeta.name,
              task_data: JSON.stringify(taskData)
          })
          
          if (res.message && res.message.saved_row_name) {
              setEnteredTasks(prev => ({
                  ...prev,
                  [key]: {
                      ...prev[key],
                      name: res.message.saved_row_name
                  }
              }))
          }
      } catch (e) {
          console.error("Auto-save failed", e)
      }
  }


  const submitScrum = async () => {
    if (!scrumMeta.name) return
    
    // Check for missing updates
    const missingEmployees = missingEmployeesData.map(e => e.employee)
    
    if (missingEmployees.length > 0) {
        setSubmitConfirmConfig({ missingCount: missingEmployees.length })
    } else {
        performSubmit(false)
    }
  }

  const performSubmit = async (sendReminders = false) => {
    setSubmitConfirmConfig(null)
    if (sendReminders) {
        await sendBulkReminders()
        showNotification("Urgent reminders sent! Proceeding with submission...")
    }
    
    setSaving(true)
    try {
      // Flush pending auto-saves before submitting
      const pendingKeys = Object.keys(autoSaveTimers.current)
      for (const key of pendingKeys) {
        if (autoSaveTimers.current[key]) {
           clearTimeout(autoSaveTimers.current[key])
           await saveRow(key, enteredTasks[key])
           autoSaveTimers.current[key] = null
        }
      }

      await post('/api/method/erpnext_scrum.erpnext_scrum.api.submit_scrum', {
        scrum_name: scrumMeta.name
      })
      showNotification("Scrum Submitted Successfully!")
      fetchData()
    } catch (e) {
      showNotification(e.message, "error")
    }
    setSaving(false)
  }

  const sendReminder = async (empId) => {
    try {
      await post('/api/method/erpnext_scrum.erpnext_scrum.api.send_individual_reminder', {
        employee: empId
      })
      showNotification('Timesheet reminder sent!')
    } catch (e) {
      showNotification('Failed to send reminder', 'error')
    }
  }

  const sendLeaveReminder = async (empId) => {
    try {
      await post('/api/method/erpnext_scrum.erpnext_scrum.api.send_leave_reminder', {
        employee: empId
      })
      showNotification('Leave reminder sent!')
    } catch (e) {
      showNotification('Failed to send leave reminder', 'error')
    }
  }
  
  
  const sendBulkReminders = async () => {
    if (missingCount === 0) {
        showNotification('No missing updates found.', 'info')
        return
    }
    setBulkReminderConfig({ missingCount })
  }

  const performBulkReminder = async () => {
    const missingEmployees = missingEmployeesData.map(e => e.employee)
    setBulkReminderConfig(null)
    
    try {
        await post('/api/method/erpnext_scrum.erpnext_scrum.api.send_timesheet_reminders', {
            employees: JSON.stringify(missingEmployees)
        })
        showNotification(`Reminders sent to ${missingEmployees.length} employees!`)
    } catch (e) {
        showNotification('Failed to send bulk reminders', 'error')
    }
  }

  const handleTaskCreated = (newTask) => {
    if (modalConfig) {
      handleTaskChange(modalConfig.empId, modalConfig.rowId, {
        ...newTask,
        employee: modalConfig.empId
      })
      setModalConfig(null)
    }
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg-color)] text-[var(--text-secondary)]">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-color)]" />
    </div>
  )

  const filteredEmployees = data.employees.filter(emp => 
    emp.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filledEmployeesSet = new Set(
    Object.entries(enteredTasks)
      .filter(([_, t]) => t && (t.task || t.task_title))
      .map(([key]) => key.split('_')[0])
  )

  const missingEmployeesData = data.employees.filter(e => 
    !e.on_leave && !filledEmployeesSet.has(e.employee)
  )

  const missingTimesheetEmployees = data.employees.filter(e => 
    !e.on_leave && e.yesterday_hours <= 4
  )


  const sendTimesheetRemindersBulk = () => {
    if (missingTimesheetEmployees.length === 0) {
        showNotification('No missing timesheets found.', 'info')
        return
    }
    setTimesheetReminderConfig({ count: missingTimesheetEmployees.length })
  }

  const performTimesheetReminderBulk = async () => {
    const employees = missingTimesheetEmployees.map(e => e.employee)
    setTimesheetReminderConfig(null)
    
    try {
        await post('/api/method/erpnext_scrum.erpnext_scrum.api.send_timesheet_reminders', {
            employees: JSON.stringify(employees)
        })
        showNotification(`Timesheet reminders sent to ${employees.length} employees!`)
    } catch (e) {
        showNotification('Failed to send reminders', 'error')
    }
  }

  const missingCount = missingEmployeesData.length
  const filledCount = filledEmployeesSet.size
  const isSubmitted = scrumMeta.docstatus === 1

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-primary)] font-sans p-4 lg:p-8">
      {timesheetReminderConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
                <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Timesheet Reminders</h3>
              <p className="text-slate-600 leading-relaxed mb-8">
                You are about to remind <span className="font-bold text-amber-600">{timesheetReminderConfig.count} employees</span> who are missing yesterday's timesheet hours.
                <br /><br />
                Do you want to send these reminders now?
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={performTimesheetReminderBulk}
                  className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Timesheet Reminders
                </button>
                <button 
                  onClick={() => setTimesheetReminderConfig(null)}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all flex items-center justify-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkReminderConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                <Bell className="w-8 h-8 text-blue-500 animate-bounce" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Bulk Reminders</h3>
              <p className="text-slate-600 leading-relaxed mb-8">
                You are about to send urgent reminders to <span className="font-bold text-blue-600">{bulkReminderConfig.missingCount} employees</span> who are missing updates.
                <br /><br />
                Do you want to proceed with sending these notifications?
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={performBulkReminder}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Yes, Send All
                </button>
                <button 
                  onClick={() => setBulkReminderConfig(null)}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all flex items-center justify-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitConfirmConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6">
                <Bell className="w-8 h-8 text-rose-500 animate-pulse" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Send Reminders?</h3>
              <p className="text-slate-600 leading-relaxed mb-8">
                There are <span className="font-bold text-rose-600">{submitConfirmConfig.missingCount} employees</span> who haven't updated their tasks or timesheets yet.
                <br /><br />
                Would you like to send them an <b>URGENT reminder</b> to update immediately before you submit?
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => performSubmit(true)}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Yes, Send & Submit
                </button>
                <button 
                  onClick={() => performSubmit(false)}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all flex items-center justify-center"
                >
                  Just Submit
                </button>
                <button 
                  onClick={() => setSubmitConfirmConfig(null)}
                  className="w-full py-3 text-slate-400 hover:text-slate-600 font-medium transition-all text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalConfig && (
        <QuickCreateModal
          employee={modalConfig.empId}
          employeeName={modalConfig.empName}
          initialSubject={modalConfig.initialSubject}
          onCreated={handleTaskCreated}
          onClose={() => setModalConfig(null)}
        />
      )}

      <header className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <Link to="/" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" title="Back to Home">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
                Daily Scrum
              </h1>
              <div className="relative group">
                <div 
                  onClick={() => dateInputRef.current?.showPicker ? dateInputRef.current.showPicker() : dateInputRef.current?.click()}
                  className="text-2xl font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-100 transition-all flex items-center shadow-sm"
                >
                  {date ? date.split('-').reverse().join('/') : '--/--/----'}
                  <Calendar className="w-5 h-5 ml-2 text-blue-400" />
                </div>
                <input 
                  ref={dateInputRef}
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-[var(--text-secondary)]">
                <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600 mr-2 shadow-sm">
                  {data.scrum_master_name?.substring(0, 1).toUpperCase()}
                </div>
                Scrum Master: <span className="text-[var(--text-primary)] ml-1.5 font-semibold">{data.scrum_master_name}</span>
              </div>
              
              {scrumMeta.status && (
                <div className="flex items-center">
                    <div className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center shadow-sm ${
                        (scrumMeta.status === 'Submitted' || scrumMeta.docstatus === 1)
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 animate-pulse ${
                        (scrumMeta.status === 'Submitted' || scrumMeta.docstatus === 1) ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                        {scrumMeta.docstatus === 1 ? 'Submitted' : (scrumMeta.status || 'DRAFT')}
                    </div>

                    {missingTimesheetEmployees.length > 0 && (
                        <button 
                            onClick={sendTimesheetRemindersBulk}
                            title={`Send timesheet reminder to ${missingTimesheetEmployees.length} employees`}
                            className="ml-3 flex items-center px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg border border-amber-200 transition-all text-[11px] font-bold shadow-sm"
                        >
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            Remind Timesheets ({missingTimesheetEmployees.length})
                        </button>
                    )}

                    {missingCount > 0 && (
                        <button 
                            onClick={sendBulkReminders}
                            title={`Send urgent reminder to ${missingCount} missing employees`}
                            className="ml-3 flex items-center px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all text-[11px] font-bold shadow-sm"
                        >
                            <Bell className="w-3.5 h-3.5 mr-1.5" />
                            Remind Missing ({missingCount})
                        </button>
                    )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Stats Cards */}
            <div className="flex items-center bg-white border border-[var(--border-color)] rounded-2xl p-1 shadow-sm">
               <div className="px-4 py-2 text-center border-r border-gray-100">
                 <span className="block text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-tight">Team</span>
                 <span className="text-lg font-bold text-[var(--text-primary)]">{data.employees.length}</span>
               </div>
               <div className="px-4 py-2 text-center border-r border-gray-100">
                 <span className="block text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-tight">Filled</span>
                 <span className={`text-lg font-bold ${filledCount > 0 ? "text-blue-600" : "text-gray-400"}`}>{filledCount}</span>
               </div>
               <div className="px-4 py-2 text-center">
                 <span className="block text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-tight">Missing</span>
                 <span className={`text-lg font-bold ${missingCount > 0 ? "text-rose-500" : "text-gray-400"}`}>{missingCount}</span>
               </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">

              {!scrumMeta.name ? (
                <button 
                  onClick={startScrum}
                  disabled={starting || !department}
                  className="flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {starting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  Start Scrum
                </button>
              ) : scrumMeta.docstatus === 0 && (
                <button 
                  onClick={submitScrum}
                  disabled={saving}
                  className="flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Scrum
                </button>
              )}

            <button 
                onClick={onLogout}
                className="p-2.5 text-[var(--text-secondary)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-[var(--border-color)]"
                title="Logout"
            >
                <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>

      {/* Custom Notification */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={`px-6 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 border ${
                notification.type === 'error' 
                    ? 'bg-red-50 border-red-100 text-red-700' 
                    : 'bg-white border-blue-100 text-blue-700'
            }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    notification.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                    {notification.type === 'error' ? <X className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </div>
                <span className="font-semibold tracking-tight">{notification.message}</span>
            </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center space-x-4 flex-1">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <input 
                        type="text"
                        placeholder="Search employees..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-colors shadow-sm"
                    />
                </div>
                <div className="flex items-center bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-lg px-3 py-1 shadow-sm">
                    <Filter className="w-4 h-4 text-[var(--text-secondary)] mr-2" />
                    <select 
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        className="bg-transparent border-none text-sm text-[var(--text-primary)] focus:ring-0 cursor-pointer py-1"
                    >
                        {data.available_departments?.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>
            </div>

            {scrumMeta.name && !isSubmitted && (
                <div className="flex items-center text-xs text-[var(--text-secondary)]">
                    <Save className="w-3 h-3 mr-1.5 text-blue-500" /> Auto-saving enabled
                </div>
            )}
        </div>

        <div className="bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-xl overflow-visible shadow-sm">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-gray-50 text-[var(--text-secondary)] text-[10px] uppercase tracking-wider">
                <th className="p-4 font-bold w-[18%] border-b border-[var(--border-color)]">Employee</th>
                <th className="p-4 font-bold w-[30%] border-b border-[var(--border-color)]">Today's tasks</th>
                <th className="p-4 font-bold w-[20%] border-b border-[var(--border-color)]">Yesterday's updates</th>
                <th className="p-4 font-bold w-[14%] border-b border-[var(--border-color)]">TS status</th>
                <th className="p-4 font-bold w-[12%] border-b border-[var(--border-color)]">Project</th>
                <th className="p-4 font-bold w-[6%] border-b border-[var(--border-color)]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map(emp => (
                  <ScrumRow 
                    key={emp.employee} 
                    emp={emp} 
                    isSubmitted={isSubmitted}
                    readOnly={!scrumMeta.name}
                    onChange={handleTaskChange}
                    onOpenModal={(config) => setModalConfig({ ...config, empId: emp.employee, empName: emp.employee_name })}
                    onSendReminder={() => sendReminder(emp.employee)}
                    onSendLeaveReminder={() => sendLeaveReminder(emp.employee)}
                    projects={data.projects}
                    externalTask={Object.entries(enteredTasks)
                      .filter(([k]) => k.startsWith(emp.employee + '_'))
                      .map(([k, v]) => ({ rowId: parseInt(k.split('_')[1]), ...v }))}
                  />
                ))
              ) : (
                <tr>
                    <td colSpan="6" className="p-12 text-center text-gray-500 italic">
                        {loading ? 'Fetching records...' : 'No employees found for this department.'}
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
