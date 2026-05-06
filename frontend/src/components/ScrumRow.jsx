import React, { useState, useEffect } from 'react'
import { TaskAutocomplete } from './TaskSelector'
import { Plus, X, Bell, ExternalLink, Clock, CheckCircle, CalendarPlus, AlertCircle, Check } from 'lucide-react'

const TASK_TYPES = ['Development', 'Customisation', 'Bug Fix', 'Learning', 'Follow Up']

export default function ScrumRow({ emp, onChange, onOpenModal, onSendReminder, onSendLeaveReminder, externalTask, readOnly, isSubmitted }) {
  const missingTs = !emp.on_leave && emp.yesterday_hours === 0
  const lowHours = !emp.on_leave && emp.yesterday_hours > 0 && emp.yesterday_hours < 5
  
  const [tasks, setTasks] = useState([{ id: 1, taskData: null, type: 'Development' }])

  // Sync with external task data (e.g. from load or modal creation)
  useEffect(() => {
    if (externalTask && externalTask.length > 0) {
      // If we only have the default empty row, replace it with external data
      if (tasks.length === 1 && !tasks[0].taskData) {
          setTasks(externalTask.map(et => ({
            id: et.rowId,
            taskData: et,
            type: et.task_type || 'Development'
          })))
      } else {
          // Otherwise just update matching rows (e.g. from modal)
          setTasks(prev => prev.map(t => {
            const match = externalTask.find(et => et.rowId === t.id)
            if (match) {
              return { ...t, taskData: match, type: match.task_type || t.type }
            }
            return t
          }))
      }
    }
  }, [externalTask])

  const updateTask = (rowId, newTaskData) => {
    if (readOnly) return
    setTasks(prev => prev.map(t => t.id === rowId ? { ...t, taskData: newTaskData } : t))
    onChange(emp.employee, rowId, newTaskData ? { 
        ...newTaskData, 
        task_type: tasks.find(t => t.id === rowId).type, 
        employee: emp.employee, 
        yesterday_task: emp.yesterday_task, 
        yesterday_hours: emp.yesterday_hours 
    } : null)
  }

  const addRow = () => {
    if (readOnly) return
    const newId = Math.max(...tasks.map(t => t.id)) + 1
    setTasks(prev => [...prev, { id: newId, taskData: null, type: 'Development' }])
  }

  const removeRow = (rowId) => {
    if (readOnly || tasks.length === 1) return
    setTasks(prev => prev.filter(t => t.id !== rowId))
  }

  return (
    <>
      {tasks.map((row, idx) => (
        <tr
          key={row.id}
          className={`border-b border-[var(--border-color)] transition-colors ${
            missingTs ? 'bg-red-50' : lowHours ? 'bg-orange-50' : 'hover:bg-gray-50'
          }`}
        >
          {/* Employee column — only show on first row */}
          {idx === 0 ? (
            <td className="p-4 align-top" rowSpan={tasks.length}>
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                  {emp.employee_name.substring(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
                    {emp.employee_name}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">{emp.designation || 'Team Member'}</div>
                  {emp.on_leave && (
                    <div className="mt-1.5 flex flex-col space-y-1">
                      {emp.leave_info?.status === 'Approved' ? (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg inline-flex items-center">
                          <Check className="w-2.5 h-2.5 mr-1" /> Approved Leave
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg inline-flex items-center">
                          <AlertCircle className="w-2.5 h-2.5 mr-1" /> Pending Leave
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </td>
          ) : null}

          {/* Today's task input */}
          <td className="p-4 align-middle">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {emp.on_leave ? (
                  <div className="px-3 py-1.5 text-sm text-gray-600 italic">No tasks during leave</div>
                ) : (
                  <TaskAutocomplete
                    key={`${emp.employee}-${row.id}`}
                    employee={emp.employee}
                    initialValue={row.taskData?.task_title || ''}
                    onSelect={(data) => updateTask(row.id, data)}
                    readOnly={readOnly}
                    placeholder="Search or type task..."
                  />
                )}
              </div>
              {!emp.on_leave && !readOnly && (
                <div className="flex items-center space-x-1">
                    <button
                        onClick={() => onOpenModal({ rowId: row.id, initialSubject: row.taskData?.task_title || '' })}
                        title="Create new system task"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    {!readOnly && tasks.length > 1 && (
                        <button
                            onClick={() => removeRow(row.id)}
                            title="Remove entry"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
              )}
            </div>
            
            {/* Metadata badges */}
            <div className="flex flex-wrap gap-2 mt-2">
                {row.taskData?.task && (
                    <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center border border-blue-100">
                        <ExternalLink className="w-3 h-3 mr-1" /> {row.taskData.task}
                    </div>
                )}
                {!!row.taskData?.is_new_task && row.taskData?.task_title && (
                    <div className="text-[10px] text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded flex items-center border border-yellow-200">
                        <CheckCircle className="w-3 h-3 mr-1" /> New Task Pending
                    </div>
                )}
            </div>
          </td>

          {/* Yesterday's task — only first row */}
          {idx === 0 ? (
            <td className="p-4 text-sm text-gray-400 align-top" rowSpan={tasks.length}>
              {emp.yesterday_task ? (
                <div className="flex flex-col">
                    <span className="line-clamp-2 leading-relaxed" title={emp.yesterday_task}>
                        {emp.yesterday_task}
                    </span>
                    {emp.yesterday_project && (
                        <span className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{emp.yesterday_project}</span>
                    )}
                </div>
              ) : (
                <span className="text-gray-600 italic">No updates recorded</span>
              )}
            </td>
          ) : null}

          {/* Timesheet — only first row */}
          {idx === 0 ? (
            <td className="p-4 align-top" rowSpan={tasks.length}>
              {emp.on_leave ? (
                <span className="text-gray-600 text-xs">—</span>
              ) : (
                <div className="flex items-center space-x-3">
                    <div className="flex flex-col">
                        <span className={`font-bold text-sm ${
                            emp.yesterday_hours >= 5 ? 'text-green-500' : 'text-red-500'
                        }`}>
                            {emp.yesterday_hours.toFixed(1)} hrs
                        </span>
                        <span className="text-[9px] text-gray-600 uppercase tracking-tighter">Yesterday</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={onSendLeaveReminder}
                            title="Remind to submit leave application"
                            className="p-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all border border-blue-200 shadow-sm"
                        >
                            <CalendarPlus className="w-4 h-4" />
                        </button>
                        {missingTs && (
                            <button 
                                onClick={onSendReminder}
                                title="Send timesheet reminder email"
                                className="p-2 text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-all border border-yellow-200 shadow-sm"
                            >
                                <Bell className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
              )}
            </td>
          ) : null}

          {/* Project */}
          <td className="p-4 text-sm text-gray-400 align-middle">
            {row.taskData?.project ? (
              <div className="flex items-center text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 max-w-fit shadow-sm">
                  <span className="text-[11px] font-medium truncate" title={row.taskData.project}>
                    {row.taskData.project}
                  </span>
              </div>
            ) : (
              <span className="text-gray-600 text-xs">—</span>
            )}
          </td>

          {/* Add row button — only on last row */}
          <td className="p-4 align-middle text-right w-24">
            {idx === tasks.length - 1 && !emp.on_leave && !readOnly && (
              <button
                onClick={addRow}
                title="Add another task for this employee"
                className="p-2 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all border border-blue-200 shadow-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </td>
        </tr>
      ))}
    </>
  )
}
