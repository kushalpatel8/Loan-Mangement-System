import { useState, useEffect, useMemo } from 'react'
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Send,
  Eye,
  RefreshCw,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  CreditCard,
  Check
} from 'lucide-react'
import {
  getApplications,
  submitAdminDecision,
  getRepaymentSchedule,
  updateInstallmentStatus,
  getAdminUsers,
  updateUserRole,
  toggleUserStatus,
  clearDummyData
} from '../../lib/loanWorkflowApi'

export default function AdminPage() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('recommended')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLoanType, setSelectedLoanType] = useState('all')

  // User Management State (Admin feature)
  const [usersList, setUsersList] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userSearchQuery, setUserSearchQuery] = useState('')

  // Selected application for Admin Decision
  const [decisionApp, setDecisionApp] = useState(null)
  const [decision, setDecision] = useState('approved')
  const [adminRemarks, setAdminRemarks] = useState('')
  const [submittingDecision, setSubmittingDecision] = useState(false)

  // Selected application for viewing EMI Repayment Schedule
  const [viewScheduleApp, setViewScheduleApp] = useState(null)
  const [scheduleData, setScheduleData] = useState(null)
  const [updatingInstallment, setUpdatingInstallment] = useState(false)
  const [paymentRefInput, setPaymentRefInput] = useState('')
  const [selectedInstallmentNum, setSelectedInstallmentNum] = useState(null)

  const [feedbackMessage, setFeedbackMessage] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getApplications({
        loanType: selectedLoanType === 'all' ? undefined : selectedLoanType,
        search: searchQuery
      })
      setApplications(data)
    } catch (err) {
      console.error('Failed to load admin applications:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const data = await getAdminUsers({
        role: userRoleFilter,
        q: userSearchQuery,
        excludeAdmin: 'true'
      })
      // Ensure only non-admin users (Applicants and Loan Officers) are shown
      const nonAdminUsers = (data || []).filter((u) => u.role !== 'admin')
      setUsersList(nonAdminUsers)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole)
      setFeedbackMessage({ type: 'success', text: `User role successfully updated to ${newRole}.` })
      await loadUsers()
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to update user role' })
    }
  }

  const handleToggleStatus = async (userId) => {
    try {
      const updated = await toggleUserStatus(userId)
      setFeedbackMessage({
        type: 'success',
        text: `User has been ${updated?.isActive ? 'Activated' : 'Suspended'}.`
      })
      await loadUsers()
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to update user status' })
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedLoanType, searchQuery])

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers()
    }
  }, [activeTab, userRoleFilter, userSearchQuery])

  // Filter applications by active tab
  const filteredApplications = useMemo(() => {
    let list = [...applications]
    if (activeTab === 'recommended') {
      list = list.filter((a) => (a.status || '').startsWith('recommended'))
    } else if (activeTab === 'approved') {
      list = list.filter((a) => a.status === 'approved')
    } else if (activeTab === 'rejected') {
      list = list.filter((a) => a.status === 'rejected')
    }
    return list
  }, [applications, activeTab])

  // Portfolio KPIs
  const kpis = useMemo(() => {
    const raw = applications
    const approved = raw.filter((a) => a.status === 'approved')
    const totalDisbursed = approved.reduce((sum, a) => sum + (Number(a.loanDetails?.amount) || 0), 0)

    return {
      total: raw.length,
      actionRequired: raw.filter((a) => (a.status || '').startsWith('recommended')).length,
      approvedCount: approved.length,
      rejectedCount: raw.filter((a) => a.status === 'rejected').length,
      totalDisbursed
    }
  }, [applications])

  // Open Admin Decision Modal
  const handleOpenDecision = (app) => {
    setDecisionApp(app)
    setDecision(app.status === 'recommended_rejection' ? 'rejected' : 'approved')
    setAdminRemarks(app.adminDecision?.remarks || '')
    setFeedbackMessage(null)
  }

  // Submit Admin Final Decision
  const handleSubmitDecision = async (e) => {
    e.preventDefault()
    if (!decisionApp) return

    setSubmittingDecision(true)
    try {
      const { app: updated, repaymentSchedule } = await submitAdminDecision(decisionApp._id, {
        decision,
        remarks: adminRemarks
      })

      setDecisionApp(null)
      setFeedbackMessage({
        type: 'success',
        text: `Application ${updated.applicationNumber} has been ${decision.toUpperCase()}. ${
          repaymentSchedule ? 'Repayment amortization schedule has been auto-generated.' : ''
        }`
      })
      await loadData()
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to submit decision' })
    } finally {
      setSubmittingDecision(false)
    }
  }

  // Open Repayment Schedule View
  const handleViewSchedule = async (app) => {
    setViewScheduleApp(app)
    try {
      const schedule = await getRepaymentSchedule(app._id)
      setScheduleData(schedule)
    } catch (err) {
      console.error(err)
    }
  }

  // Update Individual Installment Status (Bonus requirement)
  const handleUpdateInstallment = async (scheduleId, installmentNum, status) => {
    setUpdatingInstallment(true)
    try {
      const updated = await updateInstallmentStatus(scheduleId, installmentNum, {
        status,
        paymentReference: paymentRefInput || (status === 'paid' ? `ADMIN-SETTLE-${Date.now().toString().slice(-6)}` : ''),
        remarks: `Updated by Admin to ${status}`
      })
      setScheduleData(updated)
      setSelectedInstallmentNum(null)
      setPaymentRefInput('')
    } catch (err) {
      alert(err.message || 'Failed to update installment')
    } finally {
      setUpdatingInstallment(false)
    }
  }

  const getStatusBadge = (status) => {
    const config = {
      submitted: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Submitted' },
      under_review: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Under Review' },
      more_info_needed: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'More Info Needed' },
      recommended_approval: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Rec. Approval' },
      recommended_rejection: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Rec. Rejection' },
      approved: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold', label: 'Final Approved' },
      rejected: { bg: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', label: 'Final Rejected' }
    }
    const match = config[status] || { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: status }
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${match.bg}`}>
        {match.label}
      </span>
    )
  }

  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div className="bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-amber-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-300" />
              Executive Admin Governance Desk
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Final Approval, Sanction &amp; EMI Repayment
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 mt-1 leading-relaxed">
              Final sign-off on loan officer recommendations, credit risk monitoring, and automated EMI repayment schedule tracking.
            </p>
          </div>

          <button
            onClick={loadData}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-white/10 hover:bg-white/20 rounded-xl transition border border-white/20 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Portfolio
          </button>
        </div>

        {/* Portfolio KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <span className="text-xs text-stone-300">Total Applications</span>
            <div className="text-2xl font-black text-white mt-1">{kpis.total}</div>
          </div>
          <div className="bg-amber-500/15 p-4 rounded-2xl border border-amber-500/30">
            <span className="text-xs text-amber-300 flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Officer Recommended
            </span>
            <div className="text-2xl font-black text-amber-300 mt-1">{kpis.actionRequired}</div>
          </div>
          <div className="bg-emerald-500/15 p-4 rounded-2xl border border-emerald-500/30">
            <span className="text-xs text-emerald-300 font-semibold">Sanctioned Loans</span>
            <div className="text-2xl font-black text-emerald-300 mt-1">{kpis.approvedCount}</div>
          </div>
          <div className="bg-orange-500/15 p-4 rounded-2xl border border-orange-500/30">
            <span className="text-xs text-orange-300 font-semibold">Disbursed Volume</span>
            <div className="text-2xl font-black text-orange-300 mt-1">
              ₹{(kpis.totalDisbursed / 100000).toFixed(1)}L
            </div>
          </div>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl text-sm flex items-center gap-3 shadow-xs ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div>{feedbackMessage.text}</div>
        </div>
      )}

      {/* Main Queue & Controls */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-md shadow-stone-200/40 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Action Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'recommended', label: `Officer Recommended (${kpis.actionRequired})`, highlight: true },
              { id: 'all', label: 'All Applications' },
              { id: 'approved', label: 'Approved & Repayments' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'users', label: 'User Governance' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white shadow-md shadow-orange-500/25 font-bold'
                    : 'bg-[#F8F5EE] text-stone-700 hover:bg-[#F0ECE2] border border-stone-200/90'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Loan Type Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Application, Name, PAN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <select
              value={selectedLoanType}
              onChange={(e) => setSelectedLoanType(e.target.value)}
              className="w-full sm:w-auto px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
            >
              <option value="all">All Loan Types</option>
              <option value="personal">Personal Loan</option>
              <option value="home">Home Loan</option>
              <option value="vehicle">Vehicle Loan</option>
              <option value="business">Business Loan</option>
            </select>
          </div>
        </div>

        {/* User Governance View (When ActiveTab === 'users') */}
        {activeTab === 'users' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <div className="text-sm font-bold text-slate-900">
                  Registered Platform Users ({usersList.length})
                </div>
                <p className="text-xs text-slate-500">
                  Showing all Applicants and Loan Officers. Roles are permanently locked upon registration and cannot be modified.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
                >
                  <option value="all">All Roles (Applicants &amp; Officers)</option>
                  <option value="applicant">Loan Applicants</option>
                  <option value="loan_officer">Loan Officers</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-full sm:w-56"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">User Details</th>
                    <th className="px-5 py-3.5">Role (Locked)</th>
                    <th className="px-5 py-3.5">Account Status</th>
                    <th className="px-5 py-3.5">Registered / Clerk ID</th>
                    <th className="px-5 py-3.5 text-right">Account Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                        Loading registered platform users...
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                        No registered Applicants or Loan Officers found.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u._id || u.clerkId} className="hover:bg-slate-50/80 transition">
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{u.name || 'User'}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                          {u.phone && <div className="text-[11px] text-slate-400 mt-0.5">{u.phone}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              u.role === 'loan_officer'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {u.role === 'loan_officer' ? 'Loan Officer' : 'Applicant'}
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-1 font-medium">
                            🔒 Permanent Role
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              u.isActive !== false ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                            {u.isActive !== false ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-400">
                          {u.clerkId ? u.clerkId.slice(0, 18) + '...' : (u._id ? String(u._id).slice(0, 18) + '...' : 'N/A')}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleToggleStatus(u._id || u.clerkId)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs ${
                              u.isActive !== false
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {u.isActive !== false ? 'Suspend User' : 'Activate User'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Applications Table */
          <div className="overflow-x-auto rounded-2xl border border-stone-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-sm text-stone-700">
              <thead className="bg-[#F8F5EE] text-xs font-bold uppercase tracking-wider text-stone-600 border-b border-stone-200">
                <tr>
                  <th className="px-5 py-3.5">Application</th>
                  <th className="px-5 py-3.5">Applicant &amp; Income</th>
                  <th className="px-5 py-3.5">Loan Requested</th>
                  <th className="px-5 py-3.5">Officer Recommendation</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-stone-400">
                      Loading portfolio records...
                    </td>
                  </tr>
                ) : filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                      No applications currently under this category.
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => (
                    <tr key={app._id} className="hover:bg-amber-50/30 transition">
                      <td className="px-5 py-4">
                        <div className="font-bold text-[#3A1700]">{app.applicationNumber}</div>
                        <div className="text-xs text-stone-400 uppercase font-semibold mt-0.5">
                          {app.loanDetails?.loanType} Loan
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-stone-900">{app.personalDetails?.fullName || app.applicantId?.name}</div>
                        <div className="text-xs text-stone-500">
                          ₹{Number(app.incomeDetails?.monthlyIncome || 0).toLocaleString('en-IN')}/mo &bull; PAN: {app.personalDetails?.panNumber}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-[#3A1700]">
                          ₹{Number(app.loanDetails?.amount || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-xs text-stone-500">
                          {app.loanDetails?.tenureMonths} mos @ {app.loanDetails?.interestRate}%
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {app.officerReview ? (
                          <div>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                app.officerReview.recommendation === 'recommended_approval'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : app.officerReview.recommendation === 'recommended_rejection'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {app.officerReview.recommendation === 'recommended_approval' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                              )}
                              {app.officerReview.recommendation.replace('_', ' ').toUpperCase()}
                            </span>
                            <p className="text-xs text-stone-500 mt-1 max-w-xs truncate" title={app.officerReview.remarks}>
                              &quot;{app.officerReview.remarks}&quot;
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400 font-medium">Pending officer review</span>
                        )}
                      </td>
                      <td className="px-5 py-4">{getStatusBadge(app.status)}</td>
                      <td className="px-5 py-4 text-right">
                        {app.status === 'approved' ? (
                          <button
                            onClick={() => handleViewSchedule(app)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            View EMI Schedule
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenDecision(app)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm font-bold rounded-xl text-xs transition cursor-pointer active:scale-95"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Take Final Decision
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Final Decision Modal */}
      {decisionApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2E1810]/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-stone-200/80">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">Admin Decision Desk</span>
                <h3 className="text-xl font-bold mt-0.5">{decisionApp.applicationNumber}</h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  Applicant: {decisionApp.personalDetails?.fullName} &bull; Requested: ₹{Number(decisionApp.loanDetails?.amount || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setDecisionApp(null)}
                className="p-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitDecision} className="p-6 sm:p-8 space-y-6">
              {/* Officer Note Snapshot */}
              {decisionApp.officerReview && (
                <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-stone-200 space-y-1.5">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                    Loan Officer Recommendation Findings
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#3A1700] uppercase">
                      {decisionApp.officerReview.recommendation.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-stone-400">&bull; {new Date(decisionApp.officerReview.reviewedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-stone-600 italic">
                    &quot;{decisionApp.officerReview.remarks}&quot;
                  </p>
                </div>
              )}

              {/* Decision Choice */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#3A1700] uppercase tracking-wide block">
                  Final Sanction Decision *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition ${
                      decision === 'approved'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-bold text-emerald-950 block">Approve &amp; Sanction</span>
                      <span className="text-xs text-stone-500 mt-0.5 block">
                        Auto-generates {decisionApp.loanDetails?.tenureMonths}-month EMI repayment schedule
                      </span>
                    </div>
                    <input
                      type="radio"
                      name="decision"
                      value="approved"
                      checked={decision === 'approved'}
                      onChange={(e) => setDecision(e.target.value)}
                      className="accent-emerald-600 w-4 h-4"
                    />
                  </label>

                  <label
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition ${
                      decision === 'rejected'
                        ? 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-500/20'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-bold text-rose-950 block">Reject Application</span>
                      <span className="text-xs text-stone-500 mt-0.5 block">
                        Closes application with formal rejection remarks
                      </span>
                    </div>
                    <input
                      type="radio"
                      name="decision"
                      value="rejected"
                      checked={decision === 'rejected'}
                      onChange={(e) => setDecision(e.target.value)}
                      className="accent-rose-600 w-4 h-4"
                    />
                  </label>
                </div>
              </div>

              {/* Admin Remarks */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#3A1700] uppercase tracking-wide block">
                  Admin Executive Remarks &amp; Audit Trail Note
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Approved at 12.0% p.a. for 24 months. Sanction letter issued."
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  className="w-full p-3.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-stone-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setDecisionApp(null)}
                  className="px-5 py-2.5 text-xs font-bold text-stone-600 hover:bg-[#F8F5EE] rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer ${
                    decision === 'approved'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/25'
                      : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/25'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {submittingDecision ? 'Sanctioning...' : `Confirm Final ${decision.toUpperCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Schedule & Amortization Viewer (Approved Loans) */}
      {viewScheduleApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2E1810]/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-stone-200/80 my-auto">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
                  Repayment Schedule &amp; EMI Amortization
                </span>
                <h3 className="text-xl font-bold mt-0.5">{viewScheduleApp.applicationNumber}</h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  Applicant: {viewScheduleApp.personalDetails?.fullName} &bull; Principal: ₹{Number(viewScheduleApp.loanDetails?.amount || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setViewScheduleApp(null)}
                className="p-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition"
              >
                &times;
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              {scheduleData ? (
                <div className="space-y-6">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-[#F8F5EE] border border-stone-200">
                    <div>
                      <span className="text-xs text-stone-500 font-medium">Monthly EMI</span>
                      <div className="text-lg font-bold text-[#3A1700] mt-0.5">
                        ₹{Number(scheduleData.monthlyEmi || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500 font-medium">Total Interest</span>
                      <div className="text-lg font-bold text-amber-700 mt-0.5">
                        ₹{Number(scheduleData.totalInterest || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500 font-medium">Total Payable</span>
                      <div className="text-lg font-bold text-emerald-700 mt-0.5">
                        ₹{Number(scheduleData.totalAmountPayable || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-stone-500 font-medium">Loan Status</span>
                      <div className="text-lg font-bold text-amber-800 uppercase mt-0.5">
                        {scheduleData.status}
                      </div>
                    </div>
                  </div>

                  {/* Installments Table */}
                  <div className="overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="w-full text-left text-xs text-stone-700">
                      <thead className="bg-[#F8F5EE] text-stone-600 uppercase font-bold border-b border-stone-200">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Due Date</th>
                          <th className="px-4 py-3">Monthly EMI</th>
                          <th className="px-4 py-3">Principal</th>
                          <th className="px-4 py-3">Interest</th>
                          <th className="px-4 py-3">Remaining Balance</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Admin Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {scheduleData.installments?.map((inst) => (
                          <tr key={inst.installmentNumber} className="hover:bg-amber-50/30 transition">
                            <td className="px-4 py-3 font-bold text-[#3A1700]">{inst.installmentNumber}</td>
                            <td className="px-4 py-3">{new Date(inst.dueDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-bold text-stone-900">₹{inst.emiAmount?.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-stone-600">₹{inst.principalComponent?.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-amber-700 font-semibold">₹{inst.interestComponent?.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 font-semibold text-[#3A1700]">₹{inst.remainingPrincipal?.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  inst.status === 'paid'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : inst.status === 'overdue'
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : 'bg-stone-100 text-stone-700 border border-stone-200'
                                }`}
                              >
                                {inst.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-1.5">
                              {inst.status !== 'paid' && (
                                <button
                                  onClick={() => handleUpdateInstallment(scheduleData._id, inst.installmentNumber, 'paid')}
                                  disabled={updatingInstallment}
                                  className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-bold transition border border-emerald-200"
                                >
                                  Mark Paid
                                </button>
                              )}
                              {inst.status !== 'overdue' && inst.status !== 'paid' && (
                                <button
                                  onClick={() => handleUpdateInstallment(scheduleData._id, inst.installmentNumber, 'overdue')}
                                  disabled={updatingInstallment}
                                  className="px-2.5 py-1 bg-rose-50 text-rose-800 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-bold transition border border-rose-200"
                                >
                                  Overdue
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-stone-400 text-xs">
                  Loading repayment amortization schedule...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
