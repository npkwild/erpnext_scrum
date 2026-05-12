import React, { useState, useEffect, useRef } from 'react'
import { get, post } from '../utils/api'
import { Search, Plus, ExternalLink, CheckCircle, Loader2, Info, X, ChevronDown } from 'lucide-react'

const TASK_TYPES = ['Development', 'Customisation', 'Bug Fix', 'Learning', 'Follow Up']

// Task Autocomplete: fetches assigned tasks, shows dropdown
function TaskAutocomplete({ employee, onSelect, initialValue = '', placeholder = "Search or type task...", readOnly, projects = [] }) {
  const [query, setQuery] = useState(initialValue)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)
  const [isAllTasks, setIsAllTasks] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')

  useEffect(() => {
    if (!readOnly) fetchTasks('', isAllTasks, selectedProject)
  }, [employee, isAllTasks, selectedProject])

  useEffect(() => {
    if (initialValue && initialValue !== query) {
      setQuery(initialValue)
    }
  }, [initialValue])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchTasks = async (search, allTasks = false, project = '') => {
    setLoading(true)
    try {
      let url = `/api/method/erpnext_scrum.erpnext_scrum.api.get_employee_tasks?employee=${employee}&search=${search || ''}&all_tasks=${allTasks ? 1 : 0}`
      if (project) url += `&project=${encodeURIComponent(project)}`
      const res = await get(url)
      setTasks(res.message || [])
    } catch (e) {
      setTasks([])
    }
    setLoading(false)
  }

  const handleInput = (e) => {
    const val = e.target.value
    setQuery(val)
    setSelected(null)
    setOpen(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchTasks(val, isAllTasks, selectedProject), 300)
    onSelect({ task: null, task_title: val, project: selectedProject || null, is_new_task: true })
  }

  const handleSelect = (task) => {
    setSelected(task)
    setQuery(task.subject)
    setOpen(false)
    onSelect({ task: task.name, task_title: task.subject, project: task.project, is_new_task: false })
  }

  if (readOnly) {
      return (
          <div className="px-3 py-2 bg-gray-50 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]">
              {query || <span className="text-[var(--text-secondary)] italic text-xs">No task specified</span>}
          </div>
      )
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={`w-full bg-[var(--panel-bg)] border rounded-lg px-3 py-2 text-sm focus:outline-none transition-all ${
              selected
                ? 'border-[var(--accent-color)] text-[var(--accent-color)] font-medium'
                : 'border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent-color)] shadow-sm'
            }`}
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-blue-500" />
          ) : (
            <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          )}
      </div>
      
      {open && (
        <div className="absolute z-[100] w-full mt-2 bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-xl shadow-xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[var(--border-color)] flex items-center justify-between bg-gray-50">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] ml-1">
                  {isAllTasks ? 'Global Task Search' : 'Your Assigned Tasks'}
              </span>
              <div className="flex items-center gap-2">
                  <select 
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    value={selectedProject}
                    className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 font-bold text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">All Projects</option>
                    {projects.map(p => (
                      <option key={p.name} value={p.name}>{p.project_name || p.name}</option>
                    ))}
                  </select>
                  <button 
                    onMouseDown={(e) => { e.preventDefault(); setIsAllTasks(!isAllTasks) }}
                    className="text-[10px] text-[var(--accent-color)] hover:text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100"
                  >
                      {isAllTasks ? 'Global' : 'Assigned'}
                  </button>
              </div>
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar">
              {!loading && tasks.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <Info className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <div className="text-xs text-gray-400">No tasks found matching your search.</div>
                </div>
              )}
              {tasks.map(task => (
                <div
                  key={task.name}
                  onMouseDown={() => handleSelect(task)}
                  className="flex items-start px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 group transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-widest group-hover:text-blue-700">{task.name}</div>
                    <div className="text-sm text-[var(--text-primary)] truncate font-medium">{task.subject}</div>
                    {task.project && (
                      <div className="text-[10px] text-[var(--text-secondary)] mt-1 flex items-center">
                          <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full mr-1.5" />
                          {task.project}
                      </div>
                    )}
                  </div>
                  <span className="ml-3 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-50 text-[var(--text-secondary)] border border-[var(--border-color)] font-bold uppercase">
                    {task.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Quick Create Task Modal
function QuickCreateModal({ employee, employeeName, initialSubject = '', onCreated, onClose }) {
  const [subject, setSubject] = useState(initialSubject)
  const [project, setProject] = useState('')
  const [taskType, setTaskType] = useState('')
  const [taskTypes, setTaskTypes] = useState([])
  const [projects, setProjects] = useState([])
  const [expStartDate, setExpStartDate] = useState(new Date().toISOString().split('T')[0])
  const [expEndDate, setExpEndDate] = useState('')
  const [expectedTime, setExpectedTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch projects
    get(`/api/method/erpnext_scrum.erpnext_scrum.api.get_projects_for_employee?employee=${employee}`)
      .then(res => setProjects(res.message || []))
      .catch(() => setProjects([]))

    // Fetch dynamic task types
    get('/api/method/erpnext_scrum.erpnext_scrum.api.get_task_types')
      .then(res => {
        const types = res.message || []
        setTaskTypes(types)
        if (types.length > 0) setTaskType(types[0])
      })
      .catch(() => setTaskTypes(['Development', 'Customisation', 'Bug Fix', 'Learning', 'Follow Up']))
  }, [employee])

  const handleCreate = async () => {
    if (!subject.trim()) { setError('Task name is required'); return }
    if (!project) { setError('Project is required'); return }
    if (!expStartDate) { setError('Start Date is required'); return }
    if (!expEndDate) { setError('End Date is required'); return }
    if (!expectedTime || parseFloat(expectedTime) <= 0) { setError('Valid Expected Time is required'); return }
    
    setSaving(true)
    setError(null)
    
    try {
      const res = await post('/api/method/erpnext_scrum.erpnext_scrum.api.quick_create_task', {
        subject: subject.trim(),
        project: project || '',
        task_type: taskType,
        employee,
        exp_start_date: expStartDate,
        exp_end_date: expEndDate,
        expected_time: parseFloat(expectedTime)
      })

      const newTask = res.message
      onCreated({
        ...newTask,
        task: newTask.name,
        task_title: newTask.subject,
        is_new_task: false
      })
    } catch (e) {
      setError(e.message || 'Failed to create task.')
    }
    setSaving(false)
  }

  const isFormValid = subject.trim() && project && expStartDate && expEndDate && expectedTime

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border-t-4 border-t-[var(--accent-color)]">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] bg-gray-50">
          <div>
            <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Create New Task</h3>
            <div className="flex items-center mt-1.5">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center text-[10px] font-bold mr-2">
                {employeeName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-[var(--text-secondary)] font-medium">{employeeName}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-gray-100">
              <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 ml-1">Task Title *</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-all shadow-sm"
              autoFocus
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 ml-1">Project *</label>
                <select
                  value={project}
                  onChange={e => setProject(e.target.value)}
                  className="w-full bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-all appearance-none cursor-pointer shadow-sm"
                >
                  <option value="">Select Project</option>
                  {projects.map(p => (
                    <option key={p.name} value={p.name}>{p.project_name || p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 ml-1">Task Type</label>
                <select
                  value={taskType}
                  onChange={e => setTaskType(e.target.value)}
                  className="w-full bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-all appearance-none cursor-pointer shadow-sm"
                >
                  {taskTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 ml-1">Exp Start Date *</label>
                <input
                  type="date"
                  value={expStartDate}
                  onChange={e => setExpStartDate(e.target.value)}
                  className="w-full bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 ml-1">Exp End Date *</label>
                <input
                  type="date"
                  value={expEndDate}
                  onChange={e => setExpEndDate(e.target.value)}
                  className="w-full bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-all shadow-sm"
                />
              </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 ml-1">Expected Time (Hours) *</label>
            <input
              type="number"
              value={expectedTime}
              onChange={e => setExpectedTime(e.target.value)}
              placeholder="e.g. 8"
              className="w-full bg-[var(--panel-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-color)] focus:outline-none transition-all shadow-sm"
            />
          </div>
          
          {error && (
              <div className="flex items-center p-3 bg-red-900/10 border border-red-500/20 rounded-xl text-red-500 text-xs">
                  <Info className="w-4 h-4 mr-2 shrink-0" />
                  <div className="break-words overflow-hidden">{error}</div>
              </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 bg-gray-50 border-t border-[var(--border-color)]">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all rounded-xl"
          >
              Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !isFormValid}
            className="flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-md"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create & Link
          </button>
        </div>
      </div>
    </div>
  )
}

export { TaskAutocomplete, QuickCreateModal }
