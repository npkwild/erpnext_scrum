import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Filter, Search, UserCheck, Users, CalendarOff, AlertCircle, Home as HomeIcon } from 'lucide-react'
import axios from 'axios'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Dashboard({ onLogout }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [department, setDepartment] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [period, setPeriod] = useState('daily')
  const [startDate, setStartDate] = useState(getInitialStartDate('daily'))
  const [endDate, setEndDate] = useState(getInitialEndDate())

  // Dropdown options
  const [departments, setDepartments] = useState([])

  function getInitialEndDate() {
    return new Date().toISOString().split('T')[0]
  }

  function getInitialStartDate(periodType) {
    const d = new Date()
    if (periodType === 'monthly') {
      d.setDate(1) // Start of current month
    } else if (periodType === 'yearly') {
      d.setMonth(0, 1) // Start of current year
    }
    return d.toISOString().split('T')[0]
  }

  useEffect(() => {
    fetchOptions()
  }, [])

  useEffect(() => {
    fetchData()
  }, [department, period, startDate, endDate])

  const handlePeriodChange = (e) => {
    const p = e.target.value
    setPeriod(p)
    setStartDate(getInitialStartDate(p))
    setEndDate(getInitialEndDate())
  }

  const fetchOptions = async () => {
    try {
      // Basic options fetching, normally through frail APIs but we can just use frappe.client.get_list
      const deps = await axios.get('/api/resource/Department?limit=100')
      setDepartments(deps.data.data.map(d => d.name))
      
      const emps = await axios.get('/api/resource/Employee?filters=[["status","=","Active"]]&fields=["name","employee_name"]&limit=1000')
      setEmployeesList(emps.data.data)
    } catch (e) {
      console.error('Error fetching options', e)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/method/erpnext_scrum.erpnext_scrum.api.get_dashboard_metrics', {
        params: {
          start_date: startDate,
          end_date: endDate,
          department: department || undefined
        }
      })
      setData(res.data.message)
    } catch (error) {
      console.error("Failed to fetch dashboard data", error)
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = () => {
    if (!data) return;
    
    const doc = new jsPDF()
    const periodText = `${startDate} to ${endDate}`
    
    // Header
    doc.setFontSize(20)
    doc.text("Department & Employee Status Report", 14, 22)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Period: ${periodText}`, 14, 30)
    if (department) doc.text(`Department: ${department}`, 14, 36)
    
    // Aggregate Summary
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.text("Aggregate Summary", 14, 48)
    
    const summaryData = [
      ["Present Employees", data.aggregate.present],
      ["Leave Employees", data.aggregate.leave],
      ["Missed Timesheet (Under 5hr)", data.aggregate.missed_ts],
      ["Missed Daily Scrum", data.aggregate.missed_scrum],
      ["Work From Home", data.aggregate.wfh]
    ]
    
    autoTable(doc, {
      startY: 52,
      head: [['Metric', 'Count']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14 },
      tableWidth: 100
    })

    // Detailed Table
    const finalY = doc.lastAutoTable.finalY || 52
    doc.text("Employee Details", 14, finalY + 15)

    const tableColumn = ["Employee", "Dept", "TS Hrs", "Leaves", "WFH", "Missed TS", "Missed Scrum"]
    const tableRows = []

    data.employees.forEach(emp => {
      const empData = [
        emp.employee_name,
        emp.department,
        emp.total_ts_hours,
        emp.total_leaves,
        emp.wfh_days,
        emp.missed_ts_days,
        emp.missed_scrum_days
      ]
      tableRows.push(empData)
    })

    autoTable(doc, {
      startY: finalY + 20,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
    })

    doc.save(`Status_Report_${startDate}_${endDate}.pdf`)
  }

  const StatCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h4 className="text-3xl font-bold text-gray-900">{value}</h4>
      </div>
      <div className={`p-3 rounded-xl ${bgClass} ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
          </div>
          <button
            onClick={exportPDF}
            disabled={!data || data.employees.length === 0}
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Filters */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
            <select value={period} onChange={handlePeriodChange} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3 border">
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={period !== 'custom'} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3 border disabled:bg-gray-50" />
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={period !== 'custom'} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3 border disabled:bg-gray-50" />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
            <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3 border">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search Employee</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 pl-10 pr-3 border bg-white outline-none"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : data ? (
          <>
            {/* Number Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <StatCard title="Present" value={data.aggregate.present} icon={UserCheck} colorClass="text-green-600" bgClass="bg-green-100" />
              <StatCard title="On Leave" value={data.aggregate.leave} icon={CalendarOff} colorClass="text-orange-600" bgClass="bg-orange-100" />
              <StatCard title="Missed Timesheet" value={data.aggregate.missed_ts} icon={AlertCircle} colorClass="text-red-600" bgClass="bg-red-100" />
              <StatCard title="Missed Scrum" value={data.aggregate.missed_scrum} icon={Users} colorClass="text-rose-600" bgClass="bg-rose-100" />
              <StatCard title="Work From Home" value={data.aggregate.wfh} icon={HomeIcon} colorClass="text-blue-600" bgClass="bg-blue-100" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <tr>
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4 text-center">Total TS Hours</th>
                      <th className="px-6 py-4 text-center">Leaves</th>
                      <th className="px-6 py-4 text-center">WFH</th>
                      <th className="px-6 py-4 text-center text-red-600">Missed TS</th>
                      <th className="px-6 py-4 text-center text-red-600">Missed Scrum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const filteredEmployees = data.employees.filter(emp => {
                        const searchRaw = searchQuery.toLowerCase().replace(/\s+/g, '');
                        const nameRaw = emp.employee_name.toLowerCase().replace(/\s+/g, '');
                        const idRaw = emp.name.toLowerCase().replace(/\s+/g, '');
                        return nameRaw.includes(searchRaw) || idRaw.includes(searchRaw);
                      });

                      if (filteredEmployees.length === 0) {
                        return (
                          <tr>
                            <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                              No data found for the selected filters.
                            </td>
                          </tr>
                        );
                      }

                      return filteredEmployees.map((emp) => (
                        <tr key={emp.name} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              {emp.image ? (
                                <img src={emp.image} alt="" className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                  {emp.employee_name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{emp.employee_name}</p>
                                <p className="text-xs text-gray-500">{emp.designation}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{emp.department}</td>
                          <td className="px-6 py-4 text-center font-medium">{emp.total_ts_hours}</td>
                          <td className="px-6 py-4 text-center">{emp.total_leaves}</td>
                          <td className="px-6 py-4 text-center">{emp.wfh_days}</td>
                          <td className="px-6 py-4 text-center">
                            {emp.missed_ts_days > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                {emp.missed_ts_days} days
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {emp.missed_scrum_days > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">
                                {emp.missed_scrum_days} days
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
