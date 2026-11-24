import { useState, useEffect, useMemo } from 'react'
import {
  FileText,
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
  ExternalLink,
  ChevronRight,
  FileCheck,
  Info,
  Download,
  Printer,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import {
  getApplications,
  runEligibilityCheck,
  submitOfficerReview,
  clearDummyData
} from '../../lib/loanWorkflowApi'
import { exportLoanSummaryCSV, exportLoanSummaryPDF } from '../../utils/loanExportUtils'

export default function OfficerPage() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLoanType, setSelectedLoanType] = useState('all')

  // Selected application for detail review drawer/modal
  const [selectedApp, setSelectedApp] = useState(null)
  const [checkingEligibility, setCheckingEligibility] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)

  // Review Form State
  const [recommendation, setRecommendation] = useState('recommended_approval')
  const [remarks, setRemarks] = useState('')
  const [infoRequested, setInfoRequested] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState(null)

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState(null)

  // Aggregate and sort ALL documents from initial submission, response to officer, and reconsideration appeal
  const allApplicationDocuments = useMemo(() => {
    if (!selectedApp) return []

    const docs = []
    const seen = new Set()

    const addDoc = (doc, source = 'Initial Submission') => {
      if (!doc) return
      const fileName = doc.fileName || doc.name || (doc.fileUrl ? doc.fileUrl.split('/').pop().split('?')[0] : 'Document')
      const fileUrl = doc.fileUrl || doc.secure_url || doc.url || ''
      if (!fileUrl && !fileName) return

      const key = `${doc._id || ''}_${fileName}_${fileUrl}`
      if (!seen.has(key)) {
        seen.add(key)
        const uploadedAtTime = doc.uploadedAt
          ? new Date(doc.uploadedAt).getTime()
          : (source.includes('Response') || source.includes('Appeal') ? Date.now() : 0)

        docs.push({
          ...doc,
          fileName,
          fileUrl,
          source,
          uploadedAt: doc.uploadedAt || new Date().toISOString(),
          uploadedAtTime
        })
      }
    }

    // 1. Initial application documents
    if (Array.isArray(selectedApp.documents)) {
      selectedApp.documents.forEach((d) => addDoc(d, 'Initial KYC / Income Proof'))
    }

    // 2. Documents uploaded as response to officer's request
    if (selectedApp.applicantResponse) {
      if (Array.isArray(selectedApp.applicantResponse.additionalDocuments)) {
        selectedApp.applicantResponse.additionalDocuments.forEach((d) =>
          addDoc(d, 'Response to Officer Request')
        )
      }
      if (selectedApp.applicantResponse.document) {
        addDoc(selectedApp.applicantResponse.document, 'Response to Officer Request')
      }
    }

    // 3. Documents uploaded as part of reconsideration appeal
    if (selectedApp.reconsiderationRequest) {
      if (Array.isArray(selectedApp.reconsiderationRequest.additionalDocuments)) {
        selectedApp.reconsiderationRequest.additionalDocuments.forEach((d) =>
          addDoc(d, 'Reconsideration Appeal')
        )
      }
      if (selectedApp.reconsiderationRequest.document) {
        addDoc(selectedApp.reconsiderationRequest.document, 'Reconsideration Appeal')
      }
    }

    // Sort: newest / latest first
    docs.sort((a, b) => (b.uploadedAtTime || 0) - (a.uploadedAtTime || 0))

    return docs
  }, [selectedApp])

  const latestDocument = allApplicationDocuments.length > 0 ? allApplicationDocuments[0] : null

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getApplications({
        status: activeTab === 'all' ? undefined : activeTab,
        loanType: selectedLoanType === 'all' ? undefined : selectedLoanType,
        search: searchQuery,
        excludeDrafts: true
      })
      setApplications(data)
      if (selectedApp) {
        const updated = data.find((a) => a._id === selectedApp._id)
        if (updated) setSelectedApp(updated)
      }
    } catch (err) {
      console.error('Failed to load applications:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeTab, selectedLoanType, searchQuery])

  // Count metrics
  const metrics = useMemo(() => {
    const raw = applications
    return {
      total: raw.length,
      submitted: raw.filter((a) => a.status === 'submitted').length,
      underReview: raw.filter((a) => a.status === 'under_review').length,
      moreInfo: raw.filter((a) => a.status === 'more_info_needed').length,
      recommended: raw.filter((a) => (a.status || '').startsWith('recommended')).length
    }
  }, [applications])

  // Open detail review for an application
  const handleOpenReview = (app) => {
    setSelectedApp(app)
    setRecommendation(
      app.officerReview?.recommendation ||
        (app.eligibilityCheck?.isEligible === false ? 'recommended_rejection' : 'recommended_approval')
    )
    setRemarks(app.officerReview?.remarks || '')
    setInfoRequested(app.officerReview?.infoRequested || '')
    setFeedbackMessage(null)
  }

  // Trigger deterministic rule-based eligibility check
  const handleRunEligibility = async () => {
    if (!selectedApp) return
    setCheckingEligibility(true)
    try {
      const updated = await runEligibilityCheck(selectedApp._id)
      setSelectedApp(updated)
      setFeedbackMessage({
        type: updated.eligibilityCheck.isEligible ? 'success' : 'warning',
        text: `Eligibility Check Completed: ${updated.eligibilityCheck.summary}`
      })
      await loadData()
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Eligibility check failed' })
    } finally {
      setCheckingEligibility(false)
    }
  }

  // Submit officer recommendation
  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (!selectedApp) return

    if (recommendation === 'more_info_needed' && !infoRequested.trim()) {
      setFeedbackMessage({
        type: 'error',
        text: 'Please specify the exact information or documents requested from the applicant.'
      })
      return
    }

    setSubmittingReview(true)
    try {
      const updated = await submitOfficerReview(selectedApp._id, {
        recommendation,
        remarks,
        infoRequested
      })
      setSelectedApp(updated)
      setFeedbackMessage({
        type: 'success',
        text: `Recommendation submitted: ${recommendation.replace('_', ' ').toUpperCase()}`
      })
      await loadData()
    } catch (err) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to submit review' })
    } finally {
      setSubmittingReview(false)
    }
  }

  const getStatusBadge = (status) => {
    const config = {
      submitted: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Submitted (New)' },
      under_review: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Under Review' },
      more_info_needed: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'More Info Needed' },
      recommended_approval: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Rec. Approval' },
      recommended_rejection: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Rec. Rejection' },
      approved: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Final Approved' },
      rejected: { bg: 'bg-rose-100 text-rose-800 border-rose-300', label: 'Final Rejected' }
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
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-md shadow-stone-200/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs font-semibold uppercase tracking-wider mb-2 shadow-xs">
              <span>🍃</span>
              <span>Loan Officer Review Desk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#3A1700] tracking-tight">
              Application Review &amp; Underwriting
            </h1>
            <p className="text-xs sm:text-sm text-[#5C3D2E] mt-1 leading-relaxed">
              Inspect applicant records, trigger deterministic rule-based checks, request missing documents, and submit recommendations to Admin.
            </p>
          </div>

          <button
            onClick={loadData}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-stone-700 bg-[#F8F5EE] hover:bg-[#F0ECE2] border border-stone-200/90 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Queue
          </button>
        </div>

        {/* Live Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-stone-100">
          <div className="bg-[#FFFDF9] p-4 rounded-2xl border border-stone-200/80">
            <span className="text-xs font-medium text-stone-500">Queue Total</span>
            <div className="text-2xl font-black text-[#3A1700] mt-1">{metrics.total}</div>
          </div>
          <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
            <span className="text-xs font-medium text-amber-900">Needs Initial Review</span>
            <div className="text-2xl font-black text-amber-800 mt-1">{metrics.submitted}</div>
          </div>
          <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200/80">
            <span className="text-xs font-medium text-orange-900">More Info Requested</span>
            <div className="text-2xl font-black text-orange-800 mt-1">{metrics.moreInfo}</div>
          </div>
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80">
            <span className="text-xs font-medium text-emerald-900">Recommended to Admin</span>
            <div className="text-2xl font-black text-emerald-800 mt-1">{metrics.recommended}</div>
          </div>
        </div>
      </div>

      {/* Queue Filters and Search */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-md shadow-stone-200/40 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'submitted', label: 'Submitted (New)' },
              { id: 'under_review', label: 'Under Review' },
              { id: 'more_info_needed', label: 'More Info Needed' },
              { id: 'recommended_approval', label: 'Rec. Approval' },
              { id: 'recommended_rejection', label: 'Rec. Rejection' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
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
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search by ID, Name, PAN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <select
              value={selectedLoanType}
              onChange={(e) => setSelectedLoanType(e.target.value)}
              className="w-full sm:w-auto px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-medium text-stone-800"
            >
              <option value="all">All Loan Types</option>
              <option value="personal">Personal Loan</option>
              <option value="home">Home Loan</option>
              <option value="vehicle">Vehicle Loan</option>
              <option value="business">Business Loan</option>
            </select>
          </div>
        </div>

        {/* Application Queue Table */}
        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table className="w-full text-left text-sm text-stone-700">
            <thead className="bg-[#F8F5EE] text-xs font-bold uppercase tracking-wider text-stone-600 border-b border-stone-200">
              <tr>
                <th className="px-5 py-3.5">Application</th>
                <th className="px-5 py-3.5">Applicant &amp; Contact</th>
                <th className="px-5 py-3.5">Loan Details</th>
                <th className="px-5 py-3.5">Income &amp; DTI</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-400">
                    Loading loan applications...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                    No loan applications match the current filter.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app._id} className="hover:bg-amber-50/30 transition">
                    <td className="px-5 py-4">
                      <div className="font-extrabold text-[#3A1700]">{app.applicationNumber}</div>
                      <div className="text-xs text-stone-500 uppercase font-medium mt-0.5">
                        {app.loanDetails?.loanType} Loan
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-stone-900">{app.personalDetails?.fullName || app.applicantId?.name || 'Applicant'}</div>
                      <div className="text-xs text-stone-500">{app.applicantId?.email || app.personalDetails?.email || app.applicantEmail || ''}</div>
                      <div className="text-xs text-stone-400 mt-0.5">PAN: {app.personalDetails?.panNumber || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-extrabold text-[#3A1700]">
                        ₹{Number(app.loanDetails?.amount || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-stone-500">
                        {app.loanDetails?.tenureMonths} mos @ {app.loanDetails?.interestRate}%
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-stone-900">
                        ₹{Number(app.incomeDetails?.monthlyIncome || 0).toLocaleString('en-IN')}/mo
                      </div>
                      <div className="text-xs text-stone-500">
                        {app.eligibilityCheck ? (
                          <span className={app.eligibilityCheck.debtToIncomeRatio <= 50 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                            DTI: {app.eligibilityCheck.debtToIncomeRatio}%
                          </span>
                        ) : (
                          <span className="text-stone-400">DTI unverified</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {getStatusBadge(app.status)}
                        {app.reconsiderationRequest && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                              <RotateCcw className="w-2.5 h-2.5 text-amber-700" /> Appeal Filed
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleOpenReview(app)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect &amp; Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Drawer / Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-stone-200 my-auto">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-bold">{selectedApp.applicationNumber}</h2>
                  {getStatusBadge(selectedApp.status)}
                </div>
                <p className="text-xs text-stone-300 mt-1">
                  Submitted on {new Date(selectedApp.createdAt).toLocaleDateString('en-IN')} &bull; Applicant: {selectedApp.personalDetails?.fullName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportLoanSummaryCSV(selectedApp)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 cursor-pointer shadow-xs active:scale-95"
                  title="Export Applicant Loan Summary as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => exportLoanSummaryPDF(selectedApp)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-orange-500/25 cursor-pointer active:scale-95"
                  title="Print or Save Official Loan Summary PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Save / Print PDF
                </button>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer text-xl ml-1"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-8 max-h-[80vh] overflow-y-auto">
              {feedbackMessage && (
                <div
                  className={`p-4 rounded-xl text-sm flex items-start gap-3 ${
                    feedbackMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : feedbackMessage.type === 'warning'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>{feedbackMessage.text}</div>
                </div>
              )}

              {/* 1. Applicant & Loan Snapshots */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Details */}
                <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-stone-200/80 space-y-3">
                  <h3 className="font-bold text-[#3A1700] flex items-center gap-2 text-sm uppercase tracking-wide">
                    <User className="w-4 h-4 text-amber-600" />
                    Applicant Personal Profile
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-stone-500">Full Name:</span>
                      <p className="font-semibold text-stone-900 mt-0.5">{selectedApp.personalDetails?.fullName}</p>
                    </div>
                    <div>
                      <span className="text-stone-500">PAN / ID:</span>
                      <p className="font-semibold text-stone-900 mt-0.5">{selectedApp.personalDetails?.panNumber}</p>
                    </div>
                    <div>
                      <span className="text-stone-500">Date of Birth:</span>
                      <p className="font-semibold text-stone-900 mt-0.5">
                        {selectedApp.personalDetails?.dateOfBirth ? new Date(selectedApp.personalDetails.dateOfBirth).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Phone:</span>
                      <p className="font-semibold text-stone-900 mt-0.5">{selectedApp.personalDetails?.phone || selectedApp.applicantId?.phone}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-stone-200">
                      <span className="text-stone-500">Address:</span>
                      <p className="font-semibold text-stone-900 mt-0.5">
                        {selectedApp.personalDetails?.address?.street}, {selectedApp.personalDetails?.address?.city}, {selectedApp.personalDetails?.address?.state} - {selectedApp.personalDetails?.address?.postalCode}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Loan & Income Profile */}
                <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-stone-200/80 space-y-3">
                  <h3 className="font-bold text-[#3A1700] flex items-center gap-2 text-sm uppercase tracking-wide">
                    <FileText className="w-4 h-4 text-amber-600" />
                    Credit &amp; Income Profile
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-stone-500">Loan Type:</span>
                      <p className="font-semibold text-stone-900 uppercase mt-0.5">{selectedApp.loanDetails?.loanType}</p>
                    </div>
                    <div>
                      <span className="text-stone-500">Principal Requested:</span>
                      <p className="font-bold text-amber-700 text-sm mt-0.5">
                        ₹{Number(selectedApp.loanDetails?.amount || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Tenure &amp; Rate:</span>
                      <p className="font-semibold text-stone-900 mt-0.5">
                        {selectedApp.loanDetails?.tenureMonths} mos @ {selectedApp.loanDetails?.interestRate}% p.a.
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Monthly EMI Preview:</span>
                      <p className="font-bold text-emerald-700 text-sm mt-0.5">
                        ₹{Number(selectedApp.loanDetails?.monthlyEmiPreview || 0).toLocaleString('en-IN')}/mo
                      </p>
                    </div>
                    <div className="pt-2 border-t border-stone-200">
                      <span className="text-stone-500">Monthly Income:</span>
                      <p className="font-semibold text-stone-900 mt-0.5">
                        ₹{Number(selectedApp.incomeDetails?.monthlyIncome || 0).toLocaleString('en-IN')} ({selectedApp.incomeDetails?.employmentType})
                      </p>
                    </div>
                    <div className="pt-2 border-t border-stone-200">
                      <span className="text-stone-500">Existing Commitments:</span>
                      <p className="font-semibold text-stone-900 mt-0.5">
                        ₹{Number(selectedApp.incomeDetails?.existingMonthlyEmi || 0).toLocaleString('en-IN')}/mo
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Uploaded Documents Section: Featuring LATEST Document & Complete History */}
              <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="font-bold text-[#3A1700] flex items-center gap-2 text-sm uppercase tracking-wide">
                      <FileCheck className="w-4 h-4 text-amber-600" />
                      Uploaded Verification Documents ({allApplicationDocuments.length})
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      All KYC, income proofs, and latest documents re-uploaded by the applicant.
                    </p>
                  </div>
                  <span className="text-[11px] text-stone-500 bg-[#F8F5EE] border border-stone-200 px-3 py-1 rounded-full font-semibold">
                    Newest uploads listed first
                  </span>
                </div>

                {/* SPOTLIGHT: LATEST DOCUMENT SUBMITTED BY APPLICANT */}
                {latestDocument ? (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border-2 border-amber-400 rounded-2xl shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                          LATEST UPLOADED BY APPLICANT
                        </span>
                        <span className="text-[11px] text-stone-600 font-medium">
                          Context: <strong className="text-[#3A1700]">{latestDocument.source}</strong>
                        </span>
                      </div>

                      {latestDocument.uploadedAt && (
                        <span className="text-[11px] text-stone-600 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          Uploaded on {new Date(latestDocument.uploadedAt).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-amber-300 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 font-bold text-amber-900">
                          <FileCheck className="w-5 h-5 text-amber-700" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-[#3A1700] text-sm truncate" title={latestDocument.fileName}>
                            {latestDocument.fileName}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                            <span className="capitalize font-bold text-amber-800">
                              {latestDocument.documentType?.replace('_', ' ') || 'Document'}
                            </span>
                            {latestDocument.fileSize && (
                              <span>&bull; {(latestDocument.fileSize / 1024).toFixed(0)} KB</span>
                            )}
                            {latestDocument.fileUrl?.includes('cloudinary.com') && (
                              <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded border border-sky-200">
                                Cloudinary CDN
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(latestDocument)}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect Latest Document
                        </button>
                        <a
                          href={latestDocument.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200 rounded-xl transition"
                          title="Open original file in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* ALL UPLOADED DOCUMENTS GRID */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#3A1700] uppercase tracking-wide block">
                    All Application Documents ({allApplicationDocuments.length})
                  </span>

                  {allApplicationDocuments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {allApplicationDocuments.map((doc, idx) => {
                        const isLatest = idx === 0
                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                              isLatest
                                ? 'border-amber-300 bg-amber-50/50 shadow-xs'
                                : 'border-stone-200 bg-[#F8F5EE]/60 hover:bg-[#F8F5EE]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs uppercase ${
                                    isLatest ? 'bg-amber-200 text-amber-900' : 'bg-stone-200 text-stone-700'
                                  }`}
                                >
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-xs font-bold text-[#3A1700] truncate" title={doc.fileName}>
                                    {doc.fileName}
                                  </p>
                                  <span className="text-[10px] text-stone-500 uppercase font-semibold">
                                    {doc.documentType?.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>

                              {isLatest && (
                                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white rounded-full shrink-0">
                                  LATEST
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-stone-200/70 text-[10px] text-stone-500">
                              <div>
                                <span className="block font-medium text-stone-700">{doc.source}</span>
                                {doc.uploadedAt && (
                                  <span className="text-[9px] text-stone-400">
                                    {new Date(doc.uploadedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(doc)}
                                  className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                                  title="Quick Preview"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition"
                                  title="Open in New Tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-stone-400 bg-[#F8F5EE]/40 border border-dashed border-stone-200 rounded-2xl">
                      No verification documents found for this application.
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Deterministic Rule-Based Eligibility Check Panel */}
              <div className="bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white rounded-3xl p-6 sm:p-8 space-y-6 border border-amber-900/30 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                      <ShieldCheck className="w-4 h-4" />
                      Rule-Based Eligibility Engine
                    </div>
                    <h3 className="text-xl font-bold mt-1">Credit Assessment Scorecard</h3>
                    <p className="text-xs text-stone-300 mt-1">
                      Deterministic evaluation of Age boundaries, Income thresholds, Debt-to-Income (DTI) ratio, and mandatory document presence.
                    </p>
                  </div>

                  <button
                    onClick={handleRunEligibility}
                    disabled={checkingEligibility}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 cursor-pointer shadow-lg shadow-orange-500/25 active:scale-95"
                  >
                    <RefreshCw className={`w-4 h-4 ${checkingEligibility ? 'animate-spin' : ''}`} />
                    {checkingEligibility ? 'Evaluating...' : 'Run Eligibility Check'}
                  </button>
                </div>

                {selectedApp.eligibilityCheck ? (
                  <div className="space-y-6">
                    {/* Overall Verdict Banner */}
                    <div
                      className={`p-4 rounded-xl flex items-center justify-between ${
                        selectedApp.eligibilityCheck.isEligible
                          ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedApp.eligibilityCheck.isEligible ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-sm">
                            {selectedApp.eligibilityCheck.isEligible
                              ? 'PASSED ELIGIBILITY REQUIREMENTS'
                              : 'HIGH RISK / POLICY BREACH FLAGGED'}
                          </div>
                          <p className="text-xs opacity-80 mt-0.5">{selectedApp.eligibilityCheck.summary}</p>
                        </div>
                      </div>

                      <div className="text-right pl-4">
                        <span className="text-[10px] uppercase tracking-wider opacity-70">Evaluated DTI</span>
                        <div className="text-lg font-extrabold">{selectedApp.eligibilityCheck.debtToIncomeRatio}%</div>
                      </div>
                    </div>

                    {/* Detailed Rules Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedApp.eligibilityCheck.ruleResults?.map((rule, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3"
                        >
                          {rule.passed ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-white">{rule.rule}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  rule.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {rule.passed ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                            <p className="text-slate-300">{rule.message}</p>
                            <div className="text-[10px] text-slate-400 pt-1">
                              Benchmark: <span className="text-slate-200">{Array.isArray(rule.threshold) ? rule.threshold.join(', ') : rule.threshold}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Eligibility check has not been executed yet. Click &quot;Run Eligibility Check&quot; above to calculate.
                  </div>
                )}
              </div>

              {/* 4. Applicant Response to More Info (if existing) */}
              {selectedApp.applicantResponse && (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wide">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Applicant Response to Information Request
                    </div>
                    {selectedApp.applicantResponse.respondedAt && (
                      <span className="text-[10px] text-amber-700 font-semibold">
                        Responded on {new Date(selectedApp.applicantResponse.respondedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-950 font-medium leading-relaxed bg-white/80 p-3.5 rounded-xl border border-amber-200">
                    &quot;{selectedApp.applicantResponse.responseText}&quot;
                  </p>

                  {/* Attached Documents in Applicant Response */}
                  {((selectedApp.applicantResponse.additionalDocuments && selectedApp.applicantResponse.additionalDocuments.length > 0) || selectedApp.applicantResponse.document) && (
                    <div className="pt-1">
                      <span className="text-[11px] font-bold text-amber-900 block mb-1.5 uppercase tracking-wide">
                        Attached Document(s) in Response:
                      </span>
                      <div className="space-y-2">
                        {(selectedApp.applicantResponse.additionalDocuments || [selectedApp.applicantResponse.document]).filter(Boolean).map((doc, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-300 shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-bold text-stone-900 text-xs block truncate">{doc.fileName}</span>
                                <span className="text-[10px] text-stone-500 uppercase font-semibold">
                                  {doc.documentType?.replace('_', ' ')} {doc.fileSize ? `&bull; ${(doc.fileSize / 1024).toFixed(0)} KB` : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(doc)}
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> Preview
                              </button>
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition"
                                title="Open in new tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Applicant Reconsideration Appeal (if existing) */}
              {selectedApp.reconsiderationRequest && (
                <div className="p-5 rounded-2xl bg-amber-50/80 border-2 border-amber-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wide">
                      <RotateCcw className="w-4 h-4 text-amber-700" />
                      Applicant Reconsideration Appeal (Previously Rejected)
                    </div>
                    {selectedApp.reconsiderationRequest.requestedAt && (
                      <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded-full">
                        Appealed on {new Date(selectedApp.reconsiderationRequest.requestedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-950 font-medium leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-200">
                    &quot;{selectedApp.reconsiderationRequest.appealStatement}&quot;
                  </p>
                  {(selectedApp.reconsiderationRequest.adjustedAmount || selectedApp.reconsiderationRequest.adjustedTenure) && (
                    <div className="flex items-center gap-4 text-xs text-amber-900 pt-1 font-semibold">
                      {selectedApp.reconsiderationRequest.adjustedAmount && (
                        <span>
                          Adjusted Requested Principal: <strong>₹{Number(selectedApp.reconsiderationRequest.adjustedAmount).toLocaleString('en-IN')}</strong>
                        </span>
                      )}
                      {selectedApp.reconsiderationRequest.adjustedTenure && (
                        <span>
                          Adjusted Tenure: <strong>{selectedApp.reconsiderationRequest.adjustedTenure} Months</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Attached Proof in Reconsideration Appeal */}
                  {((selectedApp.reconsiderationRequest.additionalDocuments && selectedApp.reconsiderationRequest.additionalDocuments.length > 0) || selectedApp.reconsiderationRequest.document) && (
                    <div className="pt-1">
                      <span className="text-[11px] font-bold text-amber-900 block mb-1.5 uppercase tracking-wide">
                        Attached Supporting Proof:
                      </span>
                      <div className="space-y-2">
                        {(selectedApp.reconsiderationRequest.additionalDocuments || [selectedApp.reconsiderationRequest.document]).filter(Boolean).map((doc, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-300 shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-bold text-stone-900 text-xs block truncate">{doc.fileName}</span>
                                <span className="text-[10px] text-stone-500 uppercase font-semibold">
                                  {doc.documentType?.replace('_', ' ')} {doc.fileSize ? `&bull; ${(doc.fileSize / 1024).toFixed(0)} KB` : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(doc)}
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> Preview
                              </button>
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition"
                                title="Open in new tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. Loan Officer Recommendation Action Form */}
              <form onSubmit={handleSubmitReview} className="bg-white border border-stone-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <div className="border-b border-stone-100 pb-4">
                  <h3 className="text-lg font-bold text-[#3A1700]">Officer Recommendation Decision</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Select your recommendation and provide underwriting notes for the Admin review queue.
                  </p>
                </div>

                {/* Recommendation Radio Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label
                    className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition ${
                      recommendation === 'recommended_approval'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-950 uppercase">Recommend Approval</span>
                      <input
                        type="radio"
                        name="recommendation"
                        value="recommended_approval"
                        checked={recommendation === 'recommended_approval'}
                        onChange={(e) => setRecommendation(e.target.value)}
                        className="accent-emerald-600"
                      />
                    </div>
                    <p className="text-[11px] text-stone-600 mt-2">
                      Applicant satisfies policy criteria. Forward to Admin for final sanction.
                    </p>
                  </label>

                  <label
                    className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition ${
                      recommendation === 'more_info_needed'
                        ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 uppercase">Request More Info</span>
                      <input
                        type="radio"
                        name="recommendation"
                        value="more_info_needed"
                        checked={recommendation === 'more_info_needed'}
                        onChange={(e) => setRecommendation(e.target.value)}
                        className="accent-amber-600"
                      />
                    </div>
                    <p className="text-[11px] text-stone-600 mt-2">
                      Ask applicant to clarify details or re-upload missing documents.
                    </p>
                  </label>

                  <label
                    className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition ${
                      recommendation === 'recommended_rejection'
                        ? 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-500/20'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-950 uppercase">Recommend Rejection</span>
                      <input
                        type="radio"
                        name="recommendation"
                        value="recommended_rejection"
                        checked={recommendation === 'recommended_rejection'}
                        onChange={(e) => setRecommendation(e.target.value)}
                        className="accent-rose-600"
                      />
                    </div>
                    <p className="text-[11px] text-stone-600 mt-2">
                      High risk, DTI breach, or unverified documents. Forward rejection note.
                    </p>
                  </label>
                </div>

                {/* Conditional Note for "Request More Info" */}
                {recommendation === 'more_info_needed' && (
                  <div className="space-y-1.5 p-4 rounded-xl bg-amber-50/80 border border-amber-200">
                    <label className="text-xs font-bold text-amber-900 block">
                      Specific Details / Documents Required from Applicant *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="e.g. Please provide last 3 months salary slips and 6 months bank statement showing salary credits..."
                      value={infoRequested}
                      onChange={(e) => setInfoRequested(e.target.value)}
                      className="w-full p-3 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <p className="text-[10px] text-amber-700">
                      The applicant will receive this note on their dashboard and will be able to respond and re-upload documents.
                    </p>
                  </div>
                )}

                {/* General Officer Remarks */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#3A1700] block">
                    Underwriting Remarks &amp; Justification
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter any notes, verification findings, or audit justification..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full p-3 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setSelectedApp(null)}
                    className="px-5 py-2.5 text-xs font-semibold text-stone-700 bg-[#F8F5EE] hover:bg-[#F0ECE2] border border-stone-200/90 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-7 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-orange-500/25 disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingReview ? 'Submitting...' : 'Submit Officer Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Document Quick Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-[#2E1810]/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-stone-200/80">
            <div className="flex justify-between items-center pb-3 border-b border-stone-200">
              <div>
                <h4 className="font-bold text-[#3A1700] text-sm">{previewDoc.fileName}</h4>
                <span className="text-xs text-stone-500 uppercase font-semibold">{previewDoc.documentType?.replace('_', ' ')}</span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="bg-[#F8F5EE] rounded-2xl p-4 flex flex-col items-center justify-center min-h-[350px] border border-stone-200/60 overflow-hidden">
              {previewDoc.fileName?.toLowerCase().endsWith('.pdf') || previewDoc.mimeType === 'application/pdf' ? (
                <div className="w-full flex flex-col items-center space-y-3">
                  <iframe
                    src={previewDoc.fileUrl}
                    title={previewDoc.fileName}
                    className="w-full h-[420px] rounded-xl border border-stone-300 bg-white shadow-xs"
                  />
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <a
                      href={previewDoc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open on Cloudinary CDN
                    </a>

                    {previewDoc.localUrl && (
                      <a
                        href={previewDoc.localUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold transition"
                        title="Direct local server copy"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-700" /> Open via Server Mirror
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <img
                    src={previewDoc.fileUrl}
                    alt={previewDoc.fileName}
                    className="max-h-80 w-auto rounded-xl shadow-xs object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'block'
                    }}
                  />
                  <div style={{ display: 'none' }} className="text-center p-8 text-stone-500 text-xs">
                    <FileText className="w-12 h-12 mx-auto text-stone-400 mb-2" />
                    <p className="font-semibold text-stone-800">Document: {previewDoc.fileName}</p>
                    <a
                      href={previewDoc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                    </a>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-5 py-2.5 bg-[#F8F5EE] hover:bg-[#F0ECE2] text-stone-700 border border-stone-200/90 rounded-xl text-xs font-bold transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
