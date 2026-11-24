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
  updateInstallmentStatus
} from '../../lib/loanWorkflowApi'

export default function AdminPage() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('recommended')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLoanType, setSelectedLoanType] = useState('all')

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

  useEffect(() => {
    loadData()
  }, [selectedLoanType, searchQuery])

  // Filter applications by active tab
  const filteredApplications = useMemo(() => {
    let list = [...applications]
    if (activeTab === 'recommended') {
      list = list.filter((a) => a.status.startsWith('recommended'))
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
      actionRequired: raw.filter((a) => a.status.startsWith('recommended')).length,
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
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              Executive Admin Governance Desk
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Final Approval, Sanction &amp; EMI Repayment
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Final sign-off on loan officer recommendations, credit risk monitoring, and automated EMI repayment schedule tracking.
            </p>
          </div>

          <button
            onClick={loadData}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Portfolio
          </button>
        </div>

        {/* Portfolio KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60">
            <span className="text-xs text-slate-400">Total Applications</span>
            <div className="text-2xl font-bold text-white mt-1">{kpis.total}</div>
          </div>
          <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
            <span className="text-xs text-amber-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Officer Recommended
            </span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{kpis.actionRequired}</div>
          </div>
          <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
            <span className="text-xs text-emerald-300">Sanctioned Loans</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{kpis.approvedCount}</div>
          </div>
          <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
            <span className="text-xs text-blue-300">Disbursed Volume</span>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              ₹{(kpis.totalDisbursed / 100000).toFixed(1)}L
            </div>
          </div>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl text-sm flex items-center gap-3 ${
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Action Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'recommended', label: `Officer Recommended (${kpis.actionRequired})`, highlight: true },
              { id: 'all', label: 'All Applications' },
              { id: 'approved', label: 'Approved & Repayments' },
              { id: 'rejected', label: 'Rejected' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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

        {/* Applications Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Application</th>
                <th className="px-5 py-3.5">Applicant &amp; Income</th>
                <th className="px-5 py-3.5">Loan Requested</th>
                <th className="px-5 py-3.5">Officer Recommendation</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Loading portfolio records...
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No applications currently under this category.
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app._id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{app.applicationNumber}</div>
                      <div className="text-xs text-slate-400 uppercase font-medium mt-0.5">
                        {app.loanDetails?.loanType} Loan
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{app.personalDetails?.fullName || app.applicantId?.name}</div>
                      <div className="text-xs text-slate-500">
                        ₹{Number(app.incomeDetails?.monthlyIncome || 0).toLocaleString('en-IN')}/mo &bull; PAN: {app.personalDetails?.panNumber}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">
                        ₹{Number(app.loanDetails?.amount || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-slate-500">
                        {app.loanDetails?.tenureMonths} mos @ {app.loanDetails?.interestRate}%
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {app.officerReview ? (
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                              app.officerReview.recommendation === 'recommended_approval'
                                ? 'bg-emerald-50 text-emerald-700'
                                : app.officerReview.recommendation === 'recommended_rejection'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {app.officerReview.recommendation === 'recommended_approval' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                            )}
                            {app.officerReview.recommendation.replace('_', ' ').toUpperCase()}
                          </span>
                          <p className="text-xs text-slate-500 mt-1 max-w-xs truncate" title={app.officerReview.remarks}>
                            &quot;{app.officerReview.remarks}&quot;
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Pending officer review</span>
                      )}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(app.status)}</td>
                    <td className="px-5 py-4 text-right">
                      {app.status === 'approved' ? (
                        <button
                          onClick={() => handleViewSchedule(app)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          View EMI Schedule
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenDecision(app)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer"
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
      </div>

      {/* Admin Final Decision Modal */}
      {decisionApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Admin Decision Desk</span>
                <h3 className="text-xl font-bold mt-0.5">{decisionApp.applicationNumber}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Applicant: {decisionApp.personalDetails?.fullName} &bull; Requested: ₹{Number(decisionApp.loanDetails?.amount || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setDecisionApp(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitDecision} className="p-6 sm:p-8 space-y-6">
              {/* Officer Note Snapshot */}
              {decisionApp.officerReview && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Loan Officer Recommendation Findings
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase">
                      {decisionApp.officerReview.recommendation.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">&bull; {new Date(decisionApp.officerReview.reviewedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-600 italic">
                    &quot;{decisionApp.officerReview.remarks}&quot;
                  </p>
                </div>
              )}

              {/* Decision Choice */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                  Final Sanction Decision *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition ${
                      decision === 'approved'
                        ? 'border-emerald-600 bg-emerald-50/60'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-bold text-emerald-900 block">Approve &amp; Sanction</span>
                      <span className="text-xs text-slate-500 mt-0.5 block">
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
                        ? 'border-rose-600 bg-rose-50/60'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-bold text-rose-900 block">Reject Application</span>
                      <span className="text-xs text-slate-500 mt-0.5 block">
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
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                  Admin Executive Remarks &amp; Audit Trail Note
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Approved at 12.0% p.a. for 24 months. Sanction letter issued."
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDecisionApp(null)}
                  className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer ${
                    decision === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 my-auto">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold">
                  Repayment Schedule &amp; EMI Amortization
                </span>
                <h3 className="text-xl font-bold mt-0.5">{viewScheduleApp.applicationNumber}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Applicant: {viewScheduleApp.personalDetails?.fullName} &bull; Principal: ₹{Number(viewScheduleApp.loanDetails?.amount || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setViewScheduleApp(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
              >
                &times;
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              {scheduleData ? (
                <div className="space-y-6">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-xs text-slate-500">Monthly EMI</span>
                      <div className="text-lg font-bold text-slate-900 mt-0.5">
                        ₹{Number(scheduleData.monthlyEmi || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Total Interest</span>
                      <div className="text-lg font-bold text-amber-600 mt-0.5">
                        ₹{Number(scheduleData.totalInterest || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Total Payable</span>
                      <div className="text-lg font-bold text-emerald-600 mt-0.5">
                        ₹{Number(scheduleData.totalAmountPayable || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Loan Status</span>
                      <div className="text-lg font-bold text-blue-600 uppercase mt-0.5">
                        {scheduleData.status}
                      </div>
                    </div>
                  </div>

                  {/* Installments Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
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
                      <tbody className="divide-y divide-slate-100">
                        {scheduleData.installments?.map((inst) => (
                          <tr key={inst.installmentNumber} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-bold">{inst.installmentNumber}</td>
                            <td className="px-4 py-3">{new Date(inst.dueDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-semibold">₹{inst.emiAmount?.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-slate-600">₹{inst.principalComponent?.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-amber-600">₹{inst.interestComponent?.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 font-medium">₹{inst.remainingPrincipal?.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  inst.status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inst.status === 'overdue'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-600'
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
                                  className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded text-[10px] font-bold transition"
                                >
                                  Mark Paid
                                </button>
                              )}
                              {inst.status !== 'overdue' && inst.status !== 'paid' && (
                                <button
                                  onClick={() => handleUpdateInstallment(scheduleData._id, inst.installmentNumber, 'overdue')}
                                  disabled={updatingInstallment}
                                  className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded text-[10px] font-bold transition"
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
                <div className="py-12 text-center text-slate-400 text-xs">
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
