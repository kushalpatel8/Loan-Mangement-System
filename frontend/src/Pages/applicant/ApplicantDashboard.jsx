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
  FileCheck
} from 'lucide-react'
import {
  getApplications,
  getRepaymentSchedule,
  respondToMoreInfo,
  clearDummyData
} from '../../lib/loanWorkflowApi'

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
  const [submittingResponse, setSubmittingResponse] = useState(false)

  // Viewing Repayment Schedule
  const [activeScheduleApp, setActiveScheduleApp] = useState(null)
  const [scheduleData, setScheduleData] = useState(null)

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

  // Handle Submit Response to Officer
  const handleSendResponse = async (e) => {
    e.preventDefault()
    if (!moreInfoApp) return

    setSubmittingResponse(true)
    try {
      await respondToMoreInfo(moreInfoApp._id, {
        responseText,
        newDocumentName: newDocName
      })
      setMoreInfoApp(null)
      setResponseText('')
      await loadData()
    } catch (err) {
      alert(err.message || 'Failed to submit response')
    } finally {
      setSubmittingResponse(false)
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
                  <div className="flex items-center gap-2 self-start sm:self-auto">
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
                        className="px-4 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-emerald-300 shadow-2xs"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                        Repayment Schedule
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
                        onClick={() => setMoreInfoApp(app)}
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

              <div className="space-y-1">
                <label className="font-bold text-stone-700 block">Re-Upload Document (PDF / Image)</label>
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-stone-800">{newDocName}</span>
                  </div>
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                    Attached
                  </span>
                </div>
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

      {/* Repayment Schedule Modal */}
      {activeScheduleApp && scheduleData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-stone-200 my-auto">
            <div className="p-6 bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white flex justify-between items-center">
              <div>
                <span className="text-xs uppercase font-bold text-amber-300">My Repayment Amortization Schedule</span>
                <h3 className="text-lg font-bold">{activeScheduleApp.applicationNumber}</h3>
                <p className="text-xs text-stone-300">Monthly EMI: ₹{Number(scheduleData.monthlyEmi).toLocaleString('en-IN')}/mo</p>
              </div>
              <button
                onClick={() => setActiveScheduleApp(null)}
                className="p-1.5 text-stone-300 hover:text-white text-xl cursor-pointer"
              >
                &times;
              </button>
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
    </div>
  )
}
