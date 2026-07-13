import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Filter, Search, UserCheck, Users, CalendarOff, AlertCircle, Home as HomeIcon, Mail, X, ChevronDown } from 'lucide-react'
import axios from 'axios'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function Dashboard({ onLogout }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [selectedCCs, setSelectedCCs] = useState([])
  const [emailMessage, setEmailMessage] = useState('Please find the attached Daily Scrum Status Report.')
  const [isEmailing, setIsEmailing] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const [erpUsers, setErpUsers] = useState([]);
  const [toUserSearch, setToUserSearch] = useState('');
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  const toDropdownRef = React.useRef(null);

  const [ccUserSearch, setCcUserSearch] = useState('');
  const [isCcDropdownOpen, setIsCcDropdownOpen] = useState(false);
  const ccDropdownRef = React.useRef(null);
  
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000)
  }
  
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
    
    function handleClickOutside(event) {
      if (toDropdownRef.current && !toDropdownRef.current.contains(event.target)) {
        setIsToDropdownOpen(false);
      }
      if (ccDropdownRef.current && !ccDropdownRef.current.contains(event.target)) {
        setIsCcDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      // Basic options fetching
      const deps = await axios.get('/api/resource/Department?limit=100')
      setDepartments(deps.data.data.map(d => d.name))
    } catch (e) {
      console.error('Error fetching departments', e)
    }

    try {
      const usersRes = await axios.get('/api/method/erpnext_scrum.erpnext_scrum.api.get_active_users');
      if (usersRes.data && usersRes.data.message) {
        setErpUsers(usersRes.data.message);
      }
    } catch (e) {
      console.error('Error fetching active users', e)
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

  const generatePDFDoc = () => {
    if (!data) return null;
    
    const isDaily = period === 'daily';
    const doc = isDaily ? new jsPDF('l', 'mm', 'a4') : new jsPDF();
    const periodText = `${startDate} to ${endDate}`;
    
    if (isDaily) {
      const parts = startDate.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : startDate;

      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text("Date:", 14, 20);
      doc.text("Scrum Master:", 14, 28);
      doc.text("Team:", 14, 36);

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.text(formattedDate, 55, 20);
      
      const smDisplay = data.scrum_master 
        ? (data.scrum_master_name && data.scrum_master_name !== data.scrum_master ? `${data.scrum_master} (${data.scrum_master_name})` : data.scrum_master)
        : (data.scrum_master_name || "-");
      doc.text(smDisplay, 55, 28);
      doc.text(department || "All Departments", 55, 36);

      const tableColumn = ["Sr", "Employee", "Employee Name", "Task", "Task Title", "Project", "Task Type", "Timesheet Status"];
      const tableRows = [];
      let sr = 1;

      data.employees.forEach(emp => {
        if (emp.tasks && emp.tasks.length > 0) {
          emp.tasks.forEach(taskItem => {
            tableRows.push([
              String(sr++),
              emp.name,
              emp.employee_name,
              taskItem.task || "",
              taskItem.task_title || "-",
              taskItem.project_name || taskItem.project || "",
              taskItem.task_type || "Development",
              taskItem.timesheet_status || "Filled"
            ]);
          });
        } else {
          let taskTitle = "-";
          let tsStatus = emp.yesterday_ts_hours >= 1 ? "Filled" : "Missing";
          if (emp.total_leaves > 0) {
            taskTitle = "Leave";
            tsStatus = "On Leave";
          } else if (emp.wfh_days > 0) {
            taskTitle = "Work From Home";
          } else if (emp.yesterday_ts_hours >= 1) {
            taskTitle = "Present";
          }
          tableRows.push([
            String(sr++),
            emp.name,
            emp.employee_name,
            "",
            taskTitle,
            "",
            "Development",
            tsStatus
          ]);
        }
      });

      autoTable(doc, {
        startY: 44,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold', lineWidth: 0.1, lineColor: [226, 232, 240] },
        bodyStyles: { textColor: [30, 41, 59], lineWidth: 0.1, lineColor: [241, 245, 249] },
        styles: { fontSize: 8.5, cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 26 },
          2: { cellWidth: 38 },
          3: { cellWidth: 32 },
          4: { cellWidth: 'auto' },
          5: { cellWidth: 36 },
          6: { cellWidth: 28 },
          7: { cellWidth: 28 }
        }
      });

      return doc;
    }

    // Header for non-daily reports
    doc.setFontSize(20)
    doc.text("Department & Employee Status Report", 14, 22)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Period: ${periodText}`, 14, 30)
    if (department) doc.text(`Department: ${department}`, 14, 36)
    
    let finalY = 48;
    if (period === 'daily') {
      // Aggregate Summary
      doc.setFontSize(14)
      doc.setTextColor(0)
      doc.text("Aggregate Summary", 14, 48)
      
      const summaryData = [
        ["Present Employees", data.aggregate.present],
        ["Leave Employees", data.aggregate.leave],
        ["Missed Timesheet", period === 'daily' ? data.employees.filter(e => e.yesterday_ts_hours < 1).length : data.aggregate.missed_ts],
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
      finalY = doc.lastAutoTable.finalY
    }

    // Detailed Table
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.text("Employee Details", 14, finalY + 15)

    const tableColumn = ["Employee", "Dept", "TS Hrs", "Leaves", "WFH", "Missed TS", "Missed Scrum"]
    const tableRows = []

    data.employees.forEach(emp => {
      tableRows.push([
        emp.employee_name,
        emp.department,
        emp.total_ts_hours,
        emp.total_leaves,
        emp.wfh_days,
        emp.missed_ts_days,
        emp.missed_scrum_days
      ])
    })

    autoTable(doc, {
      startY: finalY + 20,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
    })

    return doc
  }

  const exportPDF = () => {
    const doc = generatePDFDoc()
    if (doc) doc.save(`Status_Report_${startDate}_${endDate}.pdf`)
  }

  const sendEmail = async () => {
    if (!emailTo) {
      alert("Please enter a 'To' email address.");
      return;
    }
    
    setIsEmailing(true);
    try {
      const doc = generatePDFDoc();
      if (!doc) return;
      
      const pdfBlob = doc.output('blob');
      const formData = new FormData();
      formData.append('report_pdf', pdfBlob, `Status_Report_${startDate}_${endDate}.pdf`);
      formData.append('to_email', emailTo);
      if (selectedCCs.length > 0) formData.append('cc_email', selectedCCs.join(','));
      formData.append('message', emailMessage);
      
      const res = await axios.post('/api/method/erpnext_scrum.erpnext_scrum.api.send_report_email', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.message) {
        showToast("Report emailed successfully!", "success");
        setIsEmailModalOpen(false);
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to send email. Please ensure email service is configured correctly.", "error");
    } finally {
      setIsEmailing(false);
    }
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
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsEmailModalOpen(true)}
              disabled={!data || data.employees.length === 0}
              className="inline-flex items-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              <span>Email Report</span>
            </button>
            <button
              onClick={exportPDF}
              disabled={!data || data.employees.length === 0}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          </div>
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
            {period === 'daily' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <StatCard title="Present" value={data.aggregate.present} icon={UserCheck} colorClass="text-green-600" bgClass="bg-green-100" />
                <StatCard title="On Leave" value={data.aggregate.leave} icon={CalendarOff} colorClass="text-orange-600" bgClass="bg-orange-100" />
                <StatCard title="Missed Timesheet" value={data.employees.filter(e => e.yesterday_ts_hours < 1).length} icon={AlertCircle} colorClass="text-red-600" bgClass="bg-red-100" />
                <StatCard title="Missed Scrum" value={data.aggregate.missed_scrum} icon={Users} colorClass="text-rose-600" bgClass="bg-rose-100" />
                <StatCard title="Work From Home" value={data.aggregate.wfh} icon={HomeIcon} colorClass="text-blue-600" bgClass="bg-blue-100" />
              </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <tr>
                      {period === 'daily' ? (
                        <>
                          <th className="px-4 py-3.5 text-center w-12">Sr</th>
                          <th className="px-4 py-3.5 text-left">Employee</th>
                          <th className="px-4 py-3.5 text-left">Employee Name</th>
                          <th className="px-4 py-3.5 text-left">Task</th>
                          <th className="px-4 py-3.5 text-left">Task Title</th>
                          <th className="px-4 py-3.5 text-left">Project</th>
                          <th className="px-4 py-3.5 text-left">Task Type</th>
                          <th className="px-4 py-3.5 text-center">Timesheet Status</th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-4">Employee</th>
                          <th className="px-6 py-4">Department</th>
                          <th className="px-6 py-4 text-center">Total TS Hours</th>
                          <th className="px-6 py-4 text-center">Leaves</th>
                          <th className="px-6 py-4 text-center">WFH</th>
                          <th className="px-6 py-4 text-center text-red-600">Missed TS</th>
                          <th className="px-6 py-4 text-center text-red-600">Missed Scrum</th>
                        </>
                      )}
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
                            <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                              No data found for the selected filters.
                            </td>
                          </tr>
                        );
                      }

                      if (period === 'daily') {
                        let sr = 1;
                        const rows = [];
                        filteredEmployees.forEach((emp) => {
                          if (emp.tasks && emp.tasks.length > 0) {
                            emp.tasks.forEach((taskItem, idx) => {
                              rows.push(
                                <tr key={`${emp.name}-${idx}`} className="hover:bg-gray-50/50 transition-colors text-sm">
                                  <td className="px-4 py-3.5 text-center font-medium text-gray-500">{sr++}</td>
                                  <td className="px-4 py-3.5 text-gray-600 font-mono text-xs">{emp.name}</td>
                                  <td className="px-4 py-3.5 font-medium text-gray-900">{emp.employee_name}</td>
                                  <td className="px-4 py-3.5 text-gray-600">{taskItem.task || ""}</td>
                                  <td className="px-4 py-3.5 text-gray-800 font-medium">{taskItem.task_title || "-"}</td>
                                  <td className="px-4 py-3.5 text-gray-600">{taskItem.project_name || taskItem.project || ""}</td>
                                  <td className="px-4 py-3.5 text-gray-600">{taskItem.task_type || "Development"}</td>
                                  <td className="px-4 py-3.5 text-center font-medium">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      taskItem.timesheet_status === 'On Leave' ? 'bg-orange-100 text-orange-800' :
                                      taskItem.timesheet_status === 'Missing' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                      {taskItem.timesheet_status || "Filled"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          } else {
                            let taskTitle = "-";
                            let tsStatus = emp.yesterday_ts_hours >= 1 ? "Filled" : "Missing";
                            if (emp.total_leaves > 0) {
                              taskTitle = "Leave";
                              tsStatus = "On Leave";
                            } else if (emp.wfh_days > 0) {
                              taskTitle = "Work From Home";
                            } else if (emp.yesterday_ts_hours >= 1) {
                              taskTitle = "Present";
                            }
                            rows.push(
                              <tr key={emp.name} className="hover:bg-gray-50/50 transition-colors text-sm">
                                <td className="px-4 py-3.5 text-center font-medium text-gray-500">{sr++}</td>
                                <td className="px-4 py-3.5 text-gray-600 font-mono text-xs">{emp.name}</td>
                                <td className="px-4 py-3.5 font-medium text-gray-900">{emp.employee_name}</td>
                                <td className="px-4 py-3.5 text-gray-600"></td>
                                <td className="px-4 py-3.5 text-gray-800 font-medium">{taskTitle}</td>
                                <td className="px-4 py-3.5 text-gray-600"></td>
                                <td className="px-4 py-3.5 text-gray-600">Development</td>
                                <td className="px-4 py-3.5 text-center font-medium">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    tsStatus === 'On Leave' ? 'bg-orange-100 text-orange-800' :
                                    tsStatus === 'Missing' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                  }`}>
                                    {tsStatus}
                                  </span>
                                </td>
                              </tr>
                            );
                          }
                        });
                        return rows;
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

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <Mail className="w-5 h-5 text-indigo-600" />
                <span>Email Status Report</span>
              </h3>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div ref={toDropdownRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">To Email <span className="text-red-500">*</span></label>
                <div 
                  className="w-full border border-gray-300 rounded-lg shadow-sm bg-white cursor-pointer px-3 py-2 text-sm flex justify-between items-center focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500"
                  onClick={() => setIsToDropdownOpen(!isToDropdownOpen)}
                >
                  <span className={`truncate pr-2 ${!emailTo && 'text-gray-400'}`}>
                    {emailTo ? erpUsers.find(u => u.email === emailTo)?.full_name || emailTo : "Select a user..."}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isToDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isToDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          className="w-full bg-white border border-gray-200 rounded-md py-1.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          placeholder="Search users..."
                          value={toUserSearch}
                          onChange={e => setToUserSearch(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                      {erpUsers.filter(u => u.full_name.toLowerCase().includes(toUserSearch.toLowerCase()) || u.email.toLowerCase().includes(toUserSearch.toLowerCase())).map(u => (
                        <div
                          key={u.email}
                          className={`px-3 py-2 rounded-md text-sm cursor-pointer mb-0.5 transition-colors ${emailTo === u.email ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}
                          onClick={() => {
                            setEmailTo(u.email);
                            setIsToDropdownOpen(false);
                            setToUserSearch('');
                          }}
                        >
                          <div className="font-medium truncate">{u.full_name}</div>
                          <div className="text-xs opacity-75 truncate">{u.email}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div ref={ccDropdownRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">CC Email</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedCCs.map(email => (
                    <span key={email} className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                      {email}
                      <X className="w-3 h-3 ml-1 cursor-pointer hover:text-indigo-900" onClick={() => setSelectedCCs(selectedCCs.filter(e => e !== email))} />
                    </span>
                  ))}
                </div>
                <div 
                  className="w-full border border-gray-300 rounded-lg shadow-sm bg-white cursor-pointer px-3 py-2 text-sm flex justify-between items-center focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500"
                  onClick={() => setIsCcDropdownOpen(!isCcDropdownOpen)}
                >
                  <span className="truncate pr-2 text-gray-400">Add CC user...</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isCcDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isCcDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          className="w-full bg-white border border-gray-200 rounded-md py-1.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          placeholder="Search users..."
                          value={ccUserSearch}
                          onChange={e => setCcUserSearch(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                      {erpUsers.filter(u => u.full_name.toLowerCase().includes(ccUserSearch.toLowerCase()) || u.email.toLowerCase().includes(ccUserSearch.toLowerCase())).map(u => (
                        <div
                          key={`cc-${u.email}`}
                          className={`px-3 py-2 rounded-md text-sm cursor-pointer mb-0.5 transition-colors text-gray-700 hover:bg-gray-100`}
                          onClick={() => {
                            if (!selectedCCs.includes(u.email)) {
                              setSelectedCCs([...selectedCCs, u.email]);
                            }
                            setIsCcDropdownOpen(false);
                            setCcUserSearch('');
                          }}
                        >
                          <div className="font-medium truncate">{u.full_name}</div>
                          <div className="text-xs opacity-75 truncate">{u.email}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea 
                  rows={4}
                  value={emailMessage} 
                  onChange={e => setEmailMessage(e.target.value)} 
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3 border"
                />
                <p className="text-xs text-gray-500 mt-1">The report PDF will be automatically attached.</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
              <button 
                onClick={() => setIsEmailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={sendEmail}
                disabled={isEmailing || !emailTo}
                className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isEmailing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Send Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 z-50 text-white transform transition-all duration-300 translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <UserCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  )
}
