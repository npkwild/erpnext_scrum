import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, Clock, Users, CheckCircle, Circle, AlertCircle, PlayCircle, BarChart2, Flag, DollarSign, FileText, ChevronDown, Search, Mail, Download, X } from 'lucide-react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ProjectAnalytics() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState('All');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('Open');
  const dropdownRef = React.useRef(null);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [selectedCCs, setSelectedCCs] = useState([]);
  const [emailMessage, setEmailMessage] = useState('Please find the attached Project Analytics Report.');
  const [isEmailing, setIsEmailing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [erpUsers, setErpUsers] = useState([]);

  const [toUserSearch, setToUserSearch] = useState('');
  const [isToDropdownOpen, setIsToDropdownOpen] = useState(false);
  const toDropdownRef = React.useRef(null);

  const [ccUserSearch, setCcUserSearch] = useState('');
  const [isCcDropdownOpen, setIsCcDropdownOpen] = useState(false);
  const ccDropdownRef = React.useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  useEffect(() => {
    fetchProjects();
    fetchUsers();
    
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (toDropdownRef.current && !toDropdownRef.current.contains(event.target)) {
        setIsToDropdownOpen(false);
      }
      if (ccDropdownRef.current && !ccDropdownRef.current.contains(event.target)) {
        setIsCcDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchAnalytics(selectedProject);
    } else {
      setData(null);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/method/erpnext_scrum.erpnext_scrum.api.get_all_projects');
      setProjects(res.data.message || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/method/erpnext_scrum.erpnext_scrum.api.get_active_users');
      if (res.data && res.data.message) {
        setErpUsers(res.data.message);
      }
    } catch (e) {
      console.error("Error fetching users for email", e);
    }
  };

  const fetchAnalytics = async (projectName) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/method/erpnext_scrum.erpnext_scrum.api.get_project_analytics', {
        params: { project_name: projectName }
      });
      setData(res.data.message);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generatePDFDoc = () => {
    if (!data) return null;
    
    const doc = new jsPDF();
    const projName = data.project.project_name || data.project.name;
    
    // Header
    doc.setFontSize(20);
    doc.text(`Project Analytics Report: ${projName}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Status: ${data.project.status} | Completion: ${Math.round(data.project.percent_complete || 0)}%`, 14, 36);
    
    let finalY = 48;
    
    // KPI Summary
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("KPI Summary", 14, finalY);
    
    const summaryData = [
      ["Total Logged Hours", `${data.total_logged_hours} hrs`],
      ["Total Tasks", data.task_stats.Total],
      ["Active Contributors", data.contributors.length],
      ["Open Tasks", data.task_stats.Open],
      ["Completed Tasks", data.task_stats.Completed]
    ];
    
    autoTable(doc, {
      startY: finalY + 4,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: 14 },
      tableWidth: 100
    });
    finalY = doc.lastAutoTable.finalY + 15;

    // Detailed Table
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Task Details", 14, finalY);

    const taskRows = [];
    data.tasks.forEach(t => {
      taskRows.push([
        t.subject,
        t.status,
        t.exp_start_date || '-',
        t.exp_end_date || '-',
        t.expected_time || 0,
        t.actual_time || 0
      ]);
    });

    autoTable(doc, {
      startY: finalY + 4,
      head: [["Task", "Status", "Exp. Start", "Exp. End", "Exp. Hrs", "Act. Hrs"]],
      body: taskRows,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
    });
    finalY = doc.lastAutoTable.finalY + 15;

    // Top Contributors Table
    if (data.contributors && data.contributors.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Top Contributors", 14, finalY);

      const contributorRows = [];
      data.contributors.forEach(c => {
        contributorRows.push([
          c.employee || 'Unknown',
          `${c.hours} hrs`
        ]);
      });

      autoTable(doc, {
        startY: finalY + 4,
        head: [["Employee", "Logged Hours"]],
        body: contributorRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 },
        tableWidth: 100
      });
    }

    return doc;
  };

  const exportPDF = () => {
    const doc = generatePDFDoc();
    const projName = data ? (data.project.project_name || data.project.name) : 'Project';
    if (doc) doc.save(`${projName}_Analytics_Report.pdf`);
  };

  const sendEmail = async () => {
    if (!emailTo) {
      alert("Please enter a 'To' email address.");
      return;
    }
    
    setIsEmailing(true);
    try {
      const doc = generatePDFDoc();
      if (!doc) return;
      
      const projName = data ? (data.project.project_name || data.project.name) : 'Project';
      const pdfBlob = doc.output('blob');
      const formData = new FormData();
      formData.append('report_pdf', pdfBlob, `${projName}_Analytics_Report.pdf`);
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
  };

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
  );

  const filteredProjects = projects.filter(p => {
    const matchesSearch = (p.project_name || p.name).toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = projectStatusFilter === 'All' || p.status === projectStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              <span>Project Analytics</span>
            </h1>
          </div>
          <div className="flex items-center space-x-4 flex-1 justify-end ml-8">
            <div className="w-full max-w-md relative" ref={dropdownRef}>
            <div 
              className="w-full border border-gray-300 rounded-lg shadow-sm bg-gray-50 cursor-pointer px-3 py-2 text-sm flex justify-between items-center focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="truncate pr-2 text-gray-700">
                {selectedProject 
                  ? `${projects.find(p => p.name === selectedProject)?.project_name || selectedProject} (${projects.find(p => p.name === selectedProject)?.status})`
                  : "Search or Select a Project..."}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </div>
            
            {isDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 border-b border-gray-100 bg-gray-50 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      className="w-full bg-white border border-gray-200 rounded-md py-1.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      placeholder="Type to search..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  <select
                    value={projectStatusFilter}
                    onChange={(e) => setProjectStatusFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-28 bg-white border border-gray-200 rounded-md py-1.5 px-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="All">All Status</option>
                    <option value="Open">Open</option>
                    <option value="Completed">Completed</option>
                    <option value="Template">Template</option>
                  </select>
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                  {filteredProjects.map(p => (
                    <div
                      key={p.name}
                      className={`px-3 py-2 rounded-md text-sm cursor-pointer mb-0.5 transition-colors ${selectedProject === p.name ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'}`}
                      onClick={() => {
                        setSelectedProject(p.name);
                        setIsDropdownOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="font-medium truncate">{p.project_name || p.name}</div>
                      <div className="text-xs opacity-75 truncate">{p.name} • {p.status}</div>
                    </div>
                  ))}
                  {filteredProjects.length === 0 && (
                    <div className="px-3 py-6 text-sm text-gray-500 text-center flex flex-col items-center">
                      <Search className="w-6 h-6 text-gray-300 mb-2" />
                      No projects found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsEmailModalOpen(true)}
              disabled={!data || data.tasks.length === 0}
              className="inline-flex items-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </button>
            <button
              onClick={exportPDF}
              disabled={!data || data.tasks.length === 0}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedProject ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-300">
              <BarChart2 className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Select a Project</h2>
            <p className="text-gray-500 max-w-md">Choose a project from the dropdown above to view comprehensive analytics, task statuses, and timesheet reports.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : data ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Section */}
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{data.project.project_name || data.project.name}</h2>
                  <div className="flex space-x-4 text-sm text-gray-500">
                    <span className="flex items-center"><Briefcase className="w-4 h-4 mr-1" /> {data.project.status}</span>
                    <span>Expected End: {data.project.expected_end_date || 'N/A'}</span>
                    <span>Priority: <strong className="text-gray-700">{data.project.priority}</strong></span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-indigo-600">{Math.round(data.project.percent_complete || 0)}%</div>
                  <div className="text-sm text-gray-500 font-medium">Completed</div>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${data.project.percent_complete || 0}%` }}
                ></div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Total Logged Hours" value={`${data.total_logged_hours} hrs`} icon={Clock} colorClass="text-blue-600" bgClass="bg-blue-100" />
              <StatCard title="Total Tasks" value={data.task_stats.Total} icon={CheckCircle} colorClass="text-emerald-600" bgClass="bg-emerald-100" />
              <StatCard title="Active Contributors" value={data.contributors.length} icon={Users} colorClass="text-purple-600" bgClass="bg-purple-100" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Task Status Breakdown */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-1">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Task Distribution</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center text-gray-600"><Circle className="w-4 h-4 mr-2 text-gray-400" /> Open</span>
                    <span className="font-bold text-gray-900">{data.task_stats.Open}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center text-gray-600"><PlayCircle className="w-4 h-4 mr-2 text-blue-500" /> Working</span>
                    <span className="font-bold text-gray-900">{data.task_stats.Working}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center text-gray-600"><AlertCircle className="w-4 h-4 mr-2 text-red-500" /> Overdue</span>
                    <span className="font-bold text-gray-900">{data.task_stats.Overdue}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center text-gray-600"><CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> Completed</span>
                    <span className="font-bold text-gray-900">{data.task_stats.Completed}</span>
                  </div>
                </div>
              </div>

              {/* Top Contributors */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Top Contributors</h3>
                {data.contributors.length > 0 ? (
                  <div className="space-y-4">
                    {data.contributors.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            {c.employee ? c.employee.charAt(0) : '?'}
                          </div>
                          <span className="font-medium text-gray-900">{c.employee || 'Unknown'}</span>
                        </div>
                        <div className="font-bold text-indigo-600">{c.hours} hrs</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No timesheet records found for this project.</p>
                )}
              </div>
            </div>

            {/* Task Details Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-gray-900">Task Details</h3>
                <div className="w-full sm:w-48">
                  <select
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value)}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-1.5 px-3 border outline-none bg-gray-50"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Open">Open</option>
                    <option value="Working">Working</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Pending Review">Pending Review</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <tr>
                      <th className="px-6 py-4">Task</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Exp. Start</th>
                      <th className="px-6 py-4 text-center">Exp. End</th>
                      <th className="px-6 py-4 text-right">Exp. Hrs</th>
                      <th className="px-6 py-4 text-right">Act. Hrs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.tasks.filter(t => taskStatusFilter === 'All' || t.status === taskStatusFilter).map(t => (
                      <tr key={t.name} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{t.subject}</div>
                          <div className="text-xs text-gray-500">{t.name}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            t.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                            t.status === 'Working' ? 'bg-blue-100 text-blue-800' :
                            t.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-500">{t.exp_start_date || '-'}</td>
                        <td className="px-6 py-4 text-center text-gray-500">{t.exp_end_date || '-'}</td>
                        <td className="px-6 py-4 text-right font-medium text-gray-600">{t.expected_time || 0}</td>
                        <td className="px-6 py-4 text-right font-bold text-indigo-600">{t.actual_time || 0}</td>
                      </tr>
                    ))}
                    {data.tasks.filter(t => taskStatusFilter === 'All' || t.status === taskStatusFilter).length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500">No tasks found matching the selected filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Milestones and Invoices Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Milestones */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center space-x-2">
                  <Flag className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-gray-900">Project Milestones</h3>
                </div>
                <div className="p-0">
                  {data.milestones && data.milestones.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {data.milestones.map(m => (
                        <div key={m.name} className="p-4 hover:bg-gray-50 transition-colors flex items-start justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{m.subject || m.milestone_name || m.name}</div>
                            <div className="text-sm text-gray-500 mt-1 flex items-center">
                              <Clock className="w-3 h-3 mr-1" /> {m.milestone_date || 'No Date'}
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            m.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {m.status || 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500 text-sm">No milestones found for this project.</div>
                  )}
                </div>
              </div>

              {/* Invoices */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-bold text-gray-900">Sales Invoices</h3>
                </div>
                <div className="p-0">
                  {data.invoices && data.invoices.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {data.invoices.map(inv => (
                        <div key={inv.name} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                          <div>
                            <div className="font-bold text-gray-900">{inv.name}</div>
                            <div className="text-sm text-gray-500 mt-1 flex items-center">
                              <FileText className="w-3 h-3 mr-1" /> {inv.posting_date || 'No Date'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">{inv.currency} {inv.grand_total}</div>
                            <div className={`text-xs font-medium mt-1 ${inv.status === 'Paid' ? 'text-emerald-600' : 'text-red-500'}`}>
                              {inv.status} • {inv.outstanding_amount > 0 ? `Out: ${inv.outstanding_amount}` : 'Settled'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500 text-sm">No invoices linked to this project.</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : null}
      </main>

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <Mail className="w-5 h-5 text-indigo-600" />
                <span>Email Project Analytics Report</span>
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
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3 border outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">The analytics report PDF will be automatically attached.</p>
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
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 z-50 text-white transform transition-all duration-300 translate-y-0 opacity-100 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
