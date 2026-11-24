import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/react'
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlusCircle,
  ArrowRight,
  Eye,
  RefreshCw,
  Send,
  Upload,
  Calendar,
  CreditCard,
  FileCheck,
  Download,
  Printer,
  RotateCcw,
  Trash2,
  Paperclip
} from 'lucide-react'
import {
  getApplications,
  getRepaymentSchedule,
  respondToMoreInfo,
  requestReconsideration,
  clearDummyData,
  uploadDocumentFile
} from '../../lib/loanWorkflowApi'
import LoanSummaryModal from '../../components/LoanSummaryModal'
import { exportLoanSummaryCSV, exportLoanSummaryPDF } from '../../utils/loanExportUtils'

export default function ApplicantDashboard() {
  const { user, isLoaded } = useUser()
  const [searchParams] = useSearchParams()
  const justSubmitted = searchParams.get('submitted')

  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  // Responding to "More Info Needed"
  const [moreInfoApp, setMoreInfoApp] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [newDocName, setNewDocName] = useState('Updated_Salary_Slip_Nov2026.pdf')
  const [uploadedDoc, setUploadedDoc] = useState(null)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [reuploadDocType, setReuploadDocType] = useState('id_proof')
  const [submittingResponse, setSubmittingResponse] = useState(false)

  // Viewing Repayment Schedule
  const [activeScheduleApp, setActiveScheduleApp] = useState(null)
  const [scheduleData, setScheduleData] = useState(null)

  // Viewing & Exporting Full Loan Summary Statement
  const [summaryModalApp, setSummaryModalApp] = useState(null)

  // Requesting Reconsideration / Appeal for Rejected Application
  const [reconsiderationApp, setReconsiderationApp] = useState(null)
  const [appealStatement, setAppealStatement] = useState('')
  const [appealAmount, setAppealAmount] = useState('')
  const [appealTenure, setAppealTenure] = useState('24')
  const [appealDocName, setAppealDocName] = useState('Updated_Income_ITR_Proof.pdf')
  const [appealUploadedDoc, setAppealUploadedDoc] = useState(null)
  const [appealUploadingDoc, setAppealUploadingDoc] = useState(false)
  const [appealDocType, setAppealDocType] = useState('income_proof')
  const [submittingAppeal, setSubmittingAppeal] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const email =
        user?.primaryEmailAddress?.emailAddress ||
        (typeof window !== 'undefined'
          ? sessionStorage.getItem('lms_user_email') || localStorage.getItem('lms_user_email')
          : null)

      if (!email) {
        setApplications([])
        setLoading(false)
        return
      }

      const cleanEmail = email.toLowerCase().trim()
      const data = await getApplications({
        forApplicantOnly: true,
        applicantEmail: cleanEmail
      })

      // Strict privacy filter: double check that every item strictly matches the logged-in applicant's email
      const myOnlyApps = (Array.isArray(data) ? data : []).filter((app) => {
        const appEmail = (
          app.applicantId?.email ||
          app.personalDetails?.email ||
          app.applicantEmail ||
          ''
        ).toLowerCase().trim()
        return appEmail === cleanEmail
      })

      setApplications(myOnlyApps)
    } catch (err) {
      console.error('Failed to load applicant dashboard applications:', err)
      setApplications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.primaryEmailAddress?.emailAddress, isLoaded])

  // Open Repayment Schedule View
  const handleOpenSchedule = async (app) => {
    setActiveScheduleApp(app)
    try {
      const schedule = await getRepaymentSchedule(app._id)
      setScheduleData(schedule)
    } catch (err) {
      console.error(err)
    }
  }

  // Open Respond to Officer Modal & Auto-detect Requested Document Type
  const handleOpenMoreInfo = (app) => {
    setMoreInfoApp(app)
    setResponseText('')
    setUploadedDoc(null)
    const req = (app?.officerReview?.infoRequested || '').toLowerCase()
    if (req.includes('pan') || req.includes('aadhaar') || req.includes('id') || req.includes('identity') || req.includes('passport')) {
      setReuploadDocType('id_proof')
    } else if (req.includes('salary') || req.includes('income') || req.includes('slip') || req.includes('itr') || req.includes('form 16')) {
      setReuploadDocType('income_proof')
    } else if (req.includes('bank') || req.includes('statement')) {
      setReuploadDocType('bank_statement')
    } else if (req.includes('address') || req.includes('utility') || req.includes('bill') || req.includes('rent')) {
      setReuploadDocType('address_proof')
    } else {
      setReuploadDocType('id_proof')
    }
  }

  // Handle Real File Selection & Upload for More Info
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDoc(true)
    try {
      const doc = await uploadDocumentFile(file, reuploadDocType)
      setUploadedDoc(doc)
    } catch (err) {
      console.warn('File upload fallback:', err)
      setUploadedDoc({
        _id: `doc_${Date.now()}`,
        documentType: reuploadDocType,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString()
      })
    } finally {
      setUploadingDoc(false)
      e.target.value = ''
    }
  }

  // Handle Submit Response to Officer
  const handleSendResponse = async (e) => {
    e.preventDefault()
    if (!moreInfoApp) return

    setSubmittingResponse(true)
    try {
      await respondToMoreInfo(moreInfoApp._id, {
        responseText,
        document: uploadedDoc,
        newDocumentName: uploadedDoc?.fileName || newDocName
      })
      setMoreInfoApp(null)
      setResponseText('')
      setUploadedDoc(null)
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to submit response')
    } finally {
      setSubmittingResponse(false)
    }
  }

  // Handle Open Reconsideration Modal
  const handleOpenReconsideration = (app) => {
    setReconsiderationApp(app)
    setAppealStatement('')
    setAppealAmount(String(app.loanDetails?.amount || 250000))
    setAppealTenure(String(app.loanDetails?.tenureMonths || 24))
    setAppealDocType('income_proof')
    setAppealUploadedDoc(null)
    setAppealDocName('Updated_Income_ITR_Proof.pdf')
  }

  // Handle Real File Selection for Appeal / Reconsideration
  const handleAppealFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAppealUploadingDoc(true)
    try {
      const doc = await uploadDocumentFile(file, appealDocType)
      setAppealUploadedDoc(doc)
    } catch (err) {
      console.warn('Appeal file upload fallback:', err)
      setAppealUploadedDoc({
        _id: `doc_${Date.now()}`,
        documentType: appealDocType,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString()
      })
    } finally {
      setAppealUploadingDoc(false)
      e.target.value = ''
    }
  }

  // Handle Submit Reconsideration Appeal
  const handleSendReconsideration = async (e) => {
    e.preventDefault()
    if (!reconsiderationApp) return

    setSubmittingAppeal(true)
    try {
      await requestReconsideration(reconsiderationApp._id, {
        appealStatement,
        adjustedAmount: appealAmount ? Number(appealAmount) : undefined,
        adjustedTenure: appealTenure ? Number(appealTenure) : undefined,
        document: appealUploadedDoc,
        newDocumentName: appealUploadedDoc?.fileName || appealDocName
      })
      setReconsiderationApp(null)
      setAppealStatement('')
      setAppealUploadedDoc(null)
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to submit reconsideration appeal')
    } finally {
      setSubmittingAppeal(false)
    }
  }

  // Timeline Step Resolver
  const getTimelineSteps = (status) => {
    const s = String(status || 'draft').toLowerCase()
    const isApproved = s === 'approved'
    const isRejected = s === 'rejected'
    const isMoreInfo = s === 'more_info_needed'
    const isRecommended = s.startsWith('recommended')
    const isUnderReview = s === 'under_review' || isRecommended || isMoreInfo || isApproved || isRejected
    const isSubmitted = s !== 'draft'

    return [
      { label: 'Draft', done: true, current: s === 'draft' },
      { label: 'Submitted', done: isSubmitted, current: s === 'submitted' },
      {
        label: isMoreInfo ? 'More Info Requested' : 'Under Review',
        done: isUnderReview,
        current: isUnderReview && !isRecommended && !isApproved && !isRejected,
        flagged: isMoreInfo
      },
      {
        label: 'Officer Recommended',
        done: isRecommended || isApproved || isRejected,
        current: isRecommended
      },
      {
        label: isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Final Decision',
        done: isApproved || isRejected,
        current: isApproved || isRejected,
        isSuccess: isApproved,
        isDanger: isRejected
      }
    ]
  }

  const getStatusBadge = (status) => {
    const s = String(status || 'draft').toLowerCase()
    const config = {
      draft: { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'Draft (Incomplete)' },
      submitted: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Submitted' },
      under_review: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Under Review' },
      more_info_needed: { bg: 'bg-amber-50 text-amber-700 border-amber-200 font-bold', label: 'More Info Needed' },
      recommended_approval: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Recommended Approval' },
      recommended_rejection: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Recommended Rejection' },
      approved: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold', label: 'Approved & Disbursed' },
      rejected: { bg: 'bg-rose-100 text-rose-800 border-rose-300 font-bold', label: 'Rejected' }
    }
    const match = config[s] || { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: s }
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${match.bg}`}>
        {match.label}
      </span>
    )
  }

  return (
    <div className="w-full space-y-8">
      {/* Top Banner */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-md shadow-stone-200/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs font-semibold uppercase tracking-wider mb-2 shadow-xs">
            <span>🍃</span>
            <span>Applicant Credit Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#3A1700] tracking-tight">
            My Loan Applications &amp; Status
          </h1>
          <p className="text-xs sm:text-sm text-[#5C3D2E] mt-1 leading-relaxed">
            Track your multi-stage credit applications, review timeline progress, respond to officer inquiries, and view active repayment schedules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-3 text-stone-600 hover:text-stone-900 bg-[#F8F5EE] hover:bg-[#F0ECE2] border border-stone-200/90 rounded-xl transition cursor-pointer"
            title="Refresh Applications"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            to="/applicant/apply"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-lg shadow-orange-500/25 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            Apply for New Loan
          </Link>
        </div>
      </div>

      {justSubmitted && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <div>
            <strong>Application submitted successfully!</strong> It has entered the Loan Officer underwriting queue. You can track progress below.
          </div>
        </div>
      )}

      {/* Applications List */}
      <div className="space-y-6">
        {loading ? (
          <div className="py-16 text-center text-stone-400 text-xs font-medium">
            Loading your loan records...
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center bg-white border border-stone-200/80 rounded-3xl space-y-4 shadow-md shadow-stone-200/40">
            <FileText className="w-12 h-12 mx-auto text-stone-300" />
            <h3 className="font-bold text-[#3A1700] text-base">No Loan Applications Found</h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
              You haven&apos;t started any loan applications yet. Choose from Personal, Home, Vehicle, or Business loans with instant EMI preview.
            </p>
            <Link
              to="/applicant/apply"
              className="inline-flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/25 active:scale-95"
            >
              Start Application <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          applications.map((app) => {
            const timelineSteps = getTimelineSteps(app.status)
            return (
              <div
                key={app._id}
                className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-md shadow-stone-200/40 space-y-6 hover:border-amber-300/80 transition"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-100/70 border border-amber-200 text-[#3A1700] flex items-center justify-center font-black text-base uppercase">
                      {app.loanDetails?.loanType?.[0] || 'L'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-[#3A1700] text-lg">{app.applicationNumber || 'LMS-APP'}</span>
                        {getStatusBadge(app.status)}
                      </div>
                      <span className="text-xs text-stone-500 uppercase font-medium tracking-wide">
                        {app.loanDetails?.loanType || 'Personal'} Loan &bull; Applied on {new Date(app.createdAt || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Top Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <button
                      onClick={() => setSummaryModalApp(app)}
                      className="px-3.5 py-2 bg-[#F8F5EE] hover:bg-[#F0ECE2] text-stone-800 border border-stone-200/90 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      title="View & Export Full Loan Summary Statement (CSV / PDF)"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-700" />
                      Export Summary
                    </button>
                    {app.status === 'draft' ? (
                      <Link
                        to={`/applicant/apply?resume=${app._id}`}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-orange-500/25"
                      >
                        Resume Step {app.currentStep || 1} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : app.status === 'approved' ? (
                      <button
                        onClick={() => handleOpenSchedule(app)}
                        className="px-4 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-emerald-300 shadow-2xs cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                        Repayment Schedule
                      </button>
                    ) : app.status === 'rejected' ? (
                      <button
                        onClick={() => handleOpenReconsideration(app)}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-orange-500/25 cursor-pointer active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Request Again
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Loan Metric Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-[#FFFDF9] border border-stone-200/80 text-xs">
                  <div>
                    <span className="text-stone-500">Loan Amount:</span>
                    <p className="font-extrabold text-[#3A1700] text-sm mt-0.5">
                      ₹{Number(app.loanDetails?.amount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-500">Monthly EMI Preview:</span>
                    <p className="font-extrabold text-amber-700 text-sm mt-0.5">
                      ₹{Number(app.loanDetails?.monthlyEmiPreview || 0).toLocaleString('en-IN')}/mo
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-500">Tenure &amp; Rate:</span>
                    <p className="font-bold text-stone-800 mt-0.5">
                      {app.loanDetails?.tenureMonths} mos @ {app.loanDetails?.interestRate}%
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-500">Monthly Income:</span>
                    <p className="font-bold text-stone-800 mt-0.5">
                      ₹{Number(app.incomeDetails?.monthlyIncome || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                {/* Real-Time Interactive Workflow Timeline */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                    Workflow Progress Timeline
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                    {timelineSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                          step.flagged
                            ? 'border-amber-400 bg-amber-50/80 text-amber-900 font-bold'
                            : step.current
                            ? 'border-amber-500 bg-amber-50/60 text-[#3A1700] font-bold ring-2 ring-amber-500/20'
                            : step.done
                            ? 'border-stone-200 bg-[#F8F5EE] text-stone-700'
                            : 'border-stone-100 bg-white text-stone-400 opacity-60'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 font-bold ${
                            step.flagged
                              ? 'bg-amber-500 text-white'
                              : step.done
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                              : 'bg-stone-200 text-stone-500'
                          }`}
                        >
                          {step.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                        </div>
                        <span className="truncate text-[11px]">{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* APPLICATION REJECTED ALERT ACTION CARD */}
                {app.status === 'rejected' && (
                  <div className="p-5 rounded-2xl bg-rose-50/70 border-2 border-rose-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-rose-900 uppercase tracking-wide">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Application Rejected &bull; Reconsideration &amp; Re-Apply Options
                      </div>
                      <span className="text-[10px] text-rose-800 font-semibold bg-rose-100 px-2.5 py-0.5 rounded-full">
                        Action Available
                      </span>
                    </div>

                    {(app.adminDecision?.remarks || app.officerReview?.remarks) && (
                      <div className="p-3 bg-white/90 rounded-xl border border-rose-200 text-xs text-rose-950 font-medium space-y-1">
                        <span className="text-[10px] font-bold text-rose-700 uppercase block">Underwriting Decision Remarks:</span>
                        <p className="italic">&quot;{app.adminDecision?.remarks || app.officerReview?.remarks}&quot;</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
                      <span className="text-[11px] text-rose-800 leading-relaxed max-w-lg">
                        Circumstances changed or need to adjust your terms? You can submit an appeal with updated documentation, or start a fresh application.
                      </span>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleOpenReconsideration(app)}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-orange-500/25 cursor-pointer active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Request Again / Appeal
                        </button>
                        <Link
                          to={`/applicant/apply?reapplyFrom=${app._id}`}
                          className="px-4 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-stone-600" /> Re-Apply Fresh
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* MORE INFO NEEDED ALERT ACTION CARD */}
                {app.status === 'more_info_needed' && app.officerReview?.infoRequested && (
                  <div className="p-5 rounded-2xl bg-amber-50/80 border-2 border-amber-300 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wide">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        Loan Officer Request: Additional Information Required
                      </div>
                      <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-2.5 py-0.5 rounded-full">
                        Action Required
                      </span>
                    </div>

                    <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-amber-950 font-medium">
                      &quot;{app.officerReview.infoRequested}&quot;
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[11px] text-amber-800">
                        Please provide clarification or attach requested documentation to continue underwriting.
                      </span>
                      <button
                        onClick={() => handleOpenMoreInfo(app)}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-orange-500/25 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Respond &amp; Re-Upload
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Respond to More Info Modal */}
      {moreInfoApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-stone-200">
            <div className="p-6 bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white flex justify-between items-center">
              <div>
                <span className="text-xs uppercase font-bold text-amber-300">Respond to Loan Officer</span>
                <h3 className="text-lg font-bold">{moreInfoApp.applicationNumber}</h3>
              </div>
              <button
                onClick={() => setMoreInfoApp(null)}
                className="p-1.5 text-stone-300 hover:text-white text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendResponse} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                <span className="font-bold block text-[11px]">Officer&apos;s Request:</span>
                <p className="mt-0.5">{moreInfoApp.officerReview?.infoRequested}</p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700 block">Your Response / Explanation *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Attached the latest salary slip for October 2026 and clarified current incentive structure..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#3A1700] text-xs">
                    Re-Upload Document / Proof (PDF, PNG, JPG) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-500 font-semibold">Doc Type:</span>
                    <select
                      value={reuploadDocType}
                      onChange={(e) => {
                        setReuploadDocType(e.target.value)
                        if (uploadedDoc) {
                          setUploadedDoc({ ...uploadedDoc, documentType: e.target.value })
                        }
                      }}
                      className="text-[11px] font-semibold bg-[#F8F5EE] border border-stone-300 rounded-lg px-2 py-1 text-[#3A1700] focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="id_proof">ID Proof (PAN / Aadhaar / Passport)</option>
                      <option value="income_proof">Income Proof (Salary Slip / ITR)</option>
                      <option value="bank_statement">Bank Statement (Last 6 Months)</option>
                      <option value="address_proof">Address Proof (Utility Bill / Rent)</option>
                      <option value="other">Other Supporting Document</option>
                    </select>
                  </div>
                </div>

                {uploadedDoc ? (
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 text-emerald-700">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 truncate block text-xs">
                            {uploadedDoc.fileName}
                          </span>
                          <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                            Ready to Send
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                          <span className="capitalize">{uploadedDoc.documentType?.replace('_', ' ') || 'Document'}</span>
                          {uploadedDoc.fileSize && (
                            <span>• {(uploadedDoc.fileSize / 1024).toFixed(1)} KB</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-semibold text-stone-700 cursor-pointer transition shadow-xs">
                        Change File
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setUploadedDoc(null)}
                        className="p-1.5 hover:bg-rose-100 text-stone-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                        title="Remove selected file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50/90 rounded-2xl cursor-pointer transition text-center group">
                      <div className="w-11 h-11 rounded-2xl bg-white shadow-xs border border-amber-200 flex items-center justify-center text-amber-700 group-hover:scale-105 transition mb-2">
                        {uploadingDoc ? (
                          <RefreshCw className="w-5 h-5 animate-spin text-amber-600" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </div>
                      <span className="font-bold text-[#3A1700] text-xs">
                        {uploadingDoc ? 'Uploading document...' : 'Click to Browse & Choose File'}
                      </span>
                      <span className="text-[11px] text-stone-500 mt-0.5">
                        Choose your PAN Card, Salary Slip, or Bank Statement (PDF, JPG, PNG up to 10MB)
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={handleFileSelect}
                        disabled={uploadingDoc}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setMoreInfoApp(null)}
                  className="px-5 py-2.5 bg-[#F8F5EE] hover:bg-[#F0ECE2] border border-stone-200/90 rounded-xl text-stone-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResponse}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold shadow-md shadow-orange-500/25 cursor-pointer"
                >
                  {submittingResponse ? 'Submitting...' : 'Send Response to Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconsideration / Appeal Modal for Rejected Application */}
      {reconsiderationApp && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white flex justify-between items-center">
              <div>
                <span className="text-xs uppercase font-bold text-amber-300">Request Reconsideration / Appeal Decision</span>
                <h3 className="text-lg font-bold">{reconsiderationApp.applicationNumber}</h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  Original Request: ₹{Number(reconsiderationApp.loanDetails?.amount || 0).toLocaleString('en-IN')} for {reconsiderationApp.loanDetails?.tenureMonths} mos
                </p>
              </div>
              <button
                onClick={() => setReconsiderationApp(null)}
                className="p-1.5 text-stone-300 hover:text-white text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendReconsideration} className="p-6 space-y-4 text-xs">
              {/* Previous Rejection Remarks */}
              {(reconsiderationApp.adminDecision?.remarks || reconsiderationApp.officerReview?.remarks) && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 space-y-1">
                  <span className="font-bold block text-[11px] text-rose-800 uppercase">Bank Rejection Reason:</span>
                  <p className="italic text-xs">&quot;{reconsiderationApp.adminDecision?.remarks || reconsiderationApp.officerReview?.remarks}&quot;</p>
                </div>
              )}

              {/* Appeal Statement */}
              <div className="space-y-1">
                <label className="font-bold text-[#3A1700] block">
                  Appeal Explanation &amp; Updated Circumstances *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. I have paid off my previous existing personal loan of ₹8,000/mo, which reduces my DTI to 28%. I have also lowered my requested principal to ₹2,50,000 to meet policy guidelines..."
                  value={appealStatement}
                  onChange={(e) => setAppealStatement(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-stone-800"
                />
              </div>

              {/* Term Adjustment Options */}
              <div className="p-4 rounded-2xl bg-[#F8F5EE] border border-stone-200 space-y-3">
                <span className="text-xs font-bold text-[#3A1700] uppercase tracking-wide block">
                  Adjust Loan Terms (Recommended to Increase Approval Chances)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-stone-600 font-semibold block mb-1">Adjusted Principal (₹)</label>
                    <input
                      type="number"
                      min="25000"
                      step="5000"
                      value={appealAmount}
                      onChange={(e) => setAppealAmount(e.target.value)}
                      className="w-full p-2.5 bg-white border border-stone-300 rounded-xl font-bold text-[#3A1700] focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-600 font-semibold block mb-1">Adjusted Tenure (Months)</label>
                    <select
                      value={appealTenure}
                      onChange={(e) => setAppealTenure(e.target.value)}
                      className="w-full p-2.5 bg-white border border-stone-300 rounded-xl font-bold text-[#3A1700] focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      <option value="12">12 Months (1 Year)</option>
                      <option value="24">24 Months (2 Years)</option>
                      <option value="36">36 Months (3 Years)</option>
                      <option value="36">36 Months (3 Years)</option>
                      <option value="48">48 Months (4 Years)</option>
                      <option value="60">60 Months (5 Years)</option>
                      <option value="84">84 Months (7 Years)</option>
                    </select>
                  </div>
                </div>

                {appealAmount && appealTenure && (
                  <div className="flex justify-between items-center pt-2 border-t border-stone-200/80 text-[11px]">
                    <span className="text-stone-500">New Estimated Monthly EMI:</span>
                    <span className="font-extrabold text-amber-700 text-sm">
                      ₹{Math.round(
                        (Number(appealAmount) *
                          ((Number(reconsiderationApp.loanDetails?.interestRate || 12) / 12) / 100) *
                          Math.pow(1 + ((Number(reconsiderationApp.loanDetails?.interestRate || 12) / 12) / 100), Number(appealTenure))) /
                          (Math.pow(1 + ((Number(reconsiderationApp.loanDetails?.interestRate || 12) / 12) / 100), Number(appealTenure)) - 1)
                      ).toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                )}
              </div>

              {/* Attach Fresh Supporting Document */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-stone-700 block text-xs">
                    Attach Fresh Supporting Proof (PDF / Image)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-500 font-semibold">Proof Type:</span>
                    <select
                      value={appealDocType}
                      onChange={(e) => {
                        setAppealDocType(e.target.value)
                        if (appealUploadedDoc) {
                          setAppealUploadedDoc({ ...appealUploadedDoc, documentType: e.target.value })
                        }
                      }}
                      className="text-[11px] font-semibold bg-[#F8F5EE] border border-stone-300 rounded-lg px-2 py-1 text-[#3A1700] focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="income_proof">Income Proof (ITR / Form 16 / Salary)</option>
                      <option value="bank_statement">Bank Statement (Recent 6 Months)</option>
                      <option value="id_proof">ID Proof / Updated KYC</option>
                      <option value="other">Clearance / Debt Closure NOC</option>
                    </select>
                  </div>
                </div>

                {appealUploadedDoc ? (
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 text-emerald-700">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 truncate block text-xs">
                            {appealUploadedDoc.fileName}
                          </span>
                          <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                            Attached
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-2">
                          <span className="capitalize">{appealDocType.replace('_', ' ')}</span>
                          {appealUploadedDoc.fileSize && (
                            <span>• {(appealUploadedDoc.fileSize / 1024).toFixed(1)} KB</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-semibold text-stone-700 cursor-pointer transition shadow-xs">
                        Change
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          onChange={handleAppealFileSelect}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setAppealUploadedDoc(null)}
                        className="p-1.5 hover:bg-rose-100 text-stone-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50/80 rounded-2xl cursor-pointer transition text-center group">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-amber-200 flex items-center justify-center text-amber-700 group-hover:scale-105 transition mb-1.5">
                        {appealUploadingDoc ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </div>
                      <span className="font-bold text-[#3A1700] text-xs">
                        {appealUploadingDoc ? 'Uploading document...' : 'Click to Browse & Select Supporting Document'}
                      </span>
                      <span className="text-[10px] text-stone-500 mt-0.5">
                        Attach ITR, Debt Closure NOC, or updated statement (PDF, JPG, PNG up to 10MB)
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={handleAppealFileSelect}
                        disabled={appealUploadingDoc}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setReconsiderationApp(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAppeal}
                  className="px-6 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold shadow-md shadow-orange-500/25 cursor-pointer disabled:opacity-50 transition active:scale-95"
                >
                  {submittingAppeal ? 'Submitting Appeal...' : 'Submit Reconsideration Appeal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Schedule Modal */}
      {activeScheduleApp && scheduleData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-stone-200 my-auto">
            <div className="p-6 bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-bold text-amber-300">My Repayment Amortization Schedule</span>
                <h3 className="text-lg font-bold">{activeScheduleApp.applicationNumber}</h3>
                <p className="text-xs text-stone-300">Monthly EMI: ₹{Number(scheduleData.monthlyEmi).toLocaleString('en-IN')}/mo</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportLoanSummaryCSV(activeScheduleApp, scheduleData)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 cursor-pointer shadow-xs active:scale-95"
                  title="Download Repayment Schedule & Summary as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                  CSV
                </button>
                <button
                  onClick={() => exportLoanSummaryPDF(activeScheduleApp, scheduleData)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-orange-500/25 cursor-pointer active:scale-95"
                  title="Print or Save Official Statement as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Save / Print PDF
                </button>
                <button
                  onClick={() => setActiveScheduleApp(null)}
                  className="p-1.5 text-stone-300 hover:text-white text-xl cursor-pointer ml-1"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-[#FFFDF9] border border-stone-200">
                <div>
                  <span className="text-stone-500">Total Principal:</span>
                  <p className="font-extrabold text-[#3A1700]">₹{Number(scheduleData.totalPrincipal).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <span className="text-stone-500">Interest Rate:</span>
                  <p className="font-extrabold text-[#3A1700]">{scheduleData.annualInterestRate}% p.a.</p>
                </div>
                <div>
                  <span className="text-stone-500">Tenure:</span>
                  <p className="font-extrabold text-[#3A1700]">{scheduleData.tenureMonths} Months</p>
                </div>
                <div>
                  <span className="text-stone-500">Total Payable:</span>
                  <p className="font-extrabold text-amber-700">₹{Number(scheduleData.totalAmountPayable).toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F5EE] font-bold text-stone-600 uppercase border-b border-stone-200">
                    <tr>
                      <th className="px-3.5 py-2.5">#</th>
                      <th className="px-3.5 py-2.5">Due Date</th>
                      <th className="px-3.5 py-2.5">EMI (₹)</th>
                      <th className="px-3.5 py-2.5">Principal</th>
                      <th className="px-3.5 py-2.5">Interest</th>
                      <th className="px-3.5 py-2.5">Remaining</th>
                      <th className="px-3.5 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {scheduleData.installments?.map((inst) => (
                      <tr key={inst.installmentNumber} className="hover:bg-amber-50/40 transition">
                        <td className="px-3.5 py-2.5 font-bold">{inst.installmentNumber}</td>
                        <td className="px-3.5 py-2.5">{new Date(inst.dueDate).toLocaleDateString()}</td>
                        <td className="px-3.5 py-2.5 font-extrabold text-[#3A1700]">₹{inst.emiAmount?.toLocaleString('en-IN')}</td>
                        <td className="px-3.5 py-2.5">₹{inst.principalComponent?.toLocaleString('en-IN')}</td>
                        <td className="px-3.5 py-2.5 text-amber-700 font-semibold">₹{inst.interestComponent?.toLocaleString('en-IN')}</td>
                        <td className="px-3.5 py-2.5">₹{inst.remainingPrincipal?.toLocaleString('en-IN')}</td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              inst.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inst.status === 'overdue'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {inst.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Dedicated Loan Summary & Statement Export Modal */}
      <LoanSummaryModal
        app={summaryModalApp}
        isOpen={Boolean(summaryModalApp)}
        onClose={() => setSummaryModalApp(null)}
      />
    </div>
  )
}
