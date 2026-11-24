import { useState, useEffect } from 'react'
import {
  FileText,
  Download,
  Printer,
  X,
  CreditCard,
  User,
  Briefcase,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Landmark
} from 'lucide-react'
import { getRepaymentSchedule } from '../lib/loanWorkflowApi'
import {
  exportLoanSummaryCSV,
  exportLoanSummaryPDF,
  formatINR
} from '../utils/loanExportUtils'

export default function LoanSummaryModal({ app, isOpen, onClose, initialSchedule = null }) {
  const [schedule, setSchedule] = useState(initialSchedule)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  useEffect(() => {
    if (!isOpen || !app) return

    if (initialSchedule) {
      setSchedule(initialSchedule)
      return
    }

    // If approved and no initial schedule, fetch the amortization schedule
    if (app.status === 'approved' && app._id) {
      setLoadingSchedule(true)
      getRepaymentSchedule(app._id)
        .then((data) => setSchedule(data))
        .catch((err) => console.warn('Could not load schedule for summary modal:', err))
        .finally(() => setLoadingSchedule(false))
    } else {
      setSchedule(null)
    }
  }, [isOpen, app, initialSchedule])

  if (!isOpen || !app) return null

  const pd = app.personalDetails || {}
  const ld = app.loanDetails || {}
  const inc = app.incomeDetails || {}
  const applicantName = pd.fullName || app.applicantId?.name || 'Applicant'
  const applicantEmail = pd.email || app.applicantId?.email || app.applicantEmail || 'N/A'
  const applicantPhone = pd.phone || app.applicantId?.phone || 'N/A'
  const addressStr = pd.address
    ? `${pd.address.street || ''}, ${pd.address.city || ''}, ${pd.address.state || ''} - ${pd.address.postalCode || ''}, ${pd.address.country || 'India'}`.replace(/^,\s*|,\s*$/g, '')
    : 'N/A'

  const handleExportCSV = () => {
    exportLoanSummaryCSV(app, schedule)
  }

  const handleExportPDF = () => {
    exportLoanSummaryPDF(app, schedule)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2E1810]/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-stone-200/80 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header with Brand */}
        <div className="p-6 bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-lg">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-amber-300 font-bold">
                  Official Loan Summary Statement
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10 text-stone-200">
                  {app.status}
                </span>
              </div>
              <h3 className="text-xl font-bold mt-0.5">{app.applicationNumber}</h3>
              <p className="text-xs text-stone-300 mt-0.5">
                Applicant: {applicantName} &bull; Applied: {app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-IN') : 'N/A'}
              </p>
            </div>
          </div>

          {/* Action Header Buttons & Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 cursor-pointer shadow-xs active:scale-95"
              title="Download as CSV Spreadsheet"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              Download CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-orange-500/25 cursor-pointer active:scale-95"
              title="Print or Save Official PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              Save / Print PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-stone-700">
          {/* Key Loan Financial Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-[#F8F5EE] border border-stone-200">
            <div>
              <span className="text-stone-500 font-medium">Principal Amount</span>
              <div className="text-lg font-extrabold text-[#3A1700] mt-0.5">
                {formatINR(ld.amount)}
              </div>
              <span className="text-[10px] text-stone-400 uppercase">{(ld.loanType || 'Personal')} Loan</span>
            </div>
            <div>
              <span className="text-stone-500 font-medium">Monthly EMI</span>
              <div className="text-lg font-extrabold text-amber-700 mt-0.5">
                {formatINR(schedule?.monthlyEmi || ld.monthlyEmiPreview)}
              </div>
              <span className="text-[10px] text-stone-400">{ld.tenureMonths || 0} Months Duration</span>
            </div>
            <div>
              <span className="text-stone-500 font-medium">Annual Interest</span>
              <div className="text-lg font-extrabold text-[#3A1700] mt-0.5">
                {ld.interestRate || 0}% p.a.
              </div>
              <span className="text-[10px] text-stone-400">Fixed Rate</span>
            </div>
            <div>
              <span className="text-stone-500 font-medium">Total Payable</span>
              <div className="text-lg font-extrabold text-emerald-700 mt-0.5">
                {formatINR(schedule?.totalAmountPayable || Number(ld.amount || 0) + Number(schedule?.totalInterest || 0))}
              </div>
              <span className="text-[10px] text-stone-400">Principal + Interest</span>
            </div>
          </div>

          {/* 2-Column Details: Applicant & Financials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Applicant Profile */}
            <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-stone-200/80 space-y-3">
              <h4 className="font-bold text-[#3A1700] flex items-center gap-2 text-xs uppercase tracking-wider">
                <User className="w-4 h-4 text-amber-600" />
                Applicant Details
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Full Name</span>
                  <span className="font-semibold text-stone-900">{applicantName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">PAN / Tax ID</span>
                  <span className="font-semibold text-stone-900">{pd.panNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Email Address</span>
                  <span className="font-semibold text-stone-900">{applicantEmail}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Phone Number</span>
                  <span className="font-semibold text-stone-900">{applicantPhone}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500">Residential Address</span>
                  <span className="font-semibold text-stone-900 text-right max-w-[60%]">{addressStr}</span>
                </div>
              </div>
            </div>

            {/* Income & Employment */}
            <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-stone-200/80 space-y-3">
              <h4 className="font-bold text-[#3A1700] flex items-center gap-2 text-xs uppercase tracking-wider">
                <Briefcase className="w-4 h-4 text-amber-600" />
                Income &amp; Employment Profile
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Monthly Gross Income</span>
                  <span className="font-semibold text-stone-900">{formatINR(inc.monthlyIncome)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Employment Nature</span>
                  <span className="font-semibold text-stone-900 uppercase">{inc.employmentType || 'Salaried'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Employer / Business</span>
                  <span className="font-semibold text-stone-900">{inc.employerName || 'Self-Employed'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Existing Commitments</span>
                  <span className="font-semibold text-stone-900">{formatINR(inc.existingMonthlyEmi)}/mo</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500">Evaluated DTI</span>
                  <span className="font-semibold text-stone-900">
                    {app.eligibilityCheck?.debtToIncomeRatio ? `${app.eligibilityCheck.debtToIncomeRatio}%` : 'Standard'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Underwriting & Sanction Notes */}
          {(app.officerReview || app.adminDecision) && (
            <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-stone-200/80 space-y-3">
              <h4 className="font-bold text-[#3A1700] flex items-center gap-2 text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Underwriting &amp; Sanction Audit Trail
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {app.officerReview && (
                  <div className="p-3.5 rounded-xl bg-[#F8F5EE] border border-stone-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-stone-500 uppercase">Loan Officer Recommendation</span>
                      <span className="text-[10px] font-bold text-amber-800 uppercase bg-amber-100/60 px-2 py-0.5 rounded">
                        {app.officerReview.recommendation?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 italic mt-1">
                      &quot;{app.officerReview.remarks}&quot;
                    </p>
                    {app.officerReview.reviewedAt && (
                      <span className="text-[10px] text-stone-400 block pt-1">
                        Reviewed on {new Date(app.officerReview.reviewedAt).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                )}

                {app.adminDecision && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase">Admin Final Sanction</span>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase bg-emerald-100 px-2 py-0.5 rounded">
                        {app.adminDecision.decision}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-950 italic mt-1">
                      &quot;{app.adminDecision.remarks}&quot;
                    </p>
                    {app.adminDecision.decidedAt && (
                      <span className="text-[10px] text-emerald-700 block pt-1">
                        Sanctioned on {new Date(app.adminDecision.decidedAt).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Repayment Schedule Table (if approved or available) */}
          {schedule && Array.isArray(schedule.installments) && schedule.installments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-[#3A1700] flex items-center gap-2 text-xs uppercase tracking-wider">
                  <CreditCard className="w-4 h-4 text-amber-600" />
                  Repayment Schedule ({schedule.installments.length} Installments)
                </h4>
                <span className="text-[11px] text-stone-500">
                  Fixed Monthly EMI: <strong>{formatINR(schedule.monthlyEmi)}</strong>
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-[#F8F5EE] text-stone-600 uppercase font-bold border-b border-stone-200">
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
                    {schedule.installments.slice(0, 12).map((inst) => (
                      <tr key={inst.installmentNumber} className="hover:bg-amber-50/30 transition">
                        <td className="px-3.5 py-2 font-bold text-[#3A1700]">{inst.installmentNumber}</td>
                        <td className="px-3.5 py-2">{new Date(inst.dueDate).toLocaleDateString('en-IN')}</td>
                        <td className="px-3.5 py-2 font-bold text-stone-900">{formatINR(inst.emiAmount)}</td>
                        <td className="px-3.5 py-2 text-stone-600">{formatINR(inst.principalComponent)}</td>
                        <td className="px-3.5 py-2 text-amber-700 font-semibold">{formatINR(inst.interestComponent)}</td>
                        <td className="px-3.5 py-2 font-medium text-stone-800">{formatINR(inst.remainingPrincipal)}</td>
                        <td className="px-3.5 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              inst.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : inst.status === 'overdue'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
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
                {schedule.installments.length > 12 && (
                  <div className="p-3 bg-[#F8F5EE] text-center text-xs text-stone-500 border-t border-stone-200">
                    Showing first 12 of {schedule.installments.length} installments. The exported CSV and PDF include all {schedule.installments.length} months in full.
                  </div>
                )}
              </div>
            </div>
          )}

          {loadingSchedule && (
            <div className="py-6 text-center text-stone-400 text-xs">
              Loading repayment schedule...
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-4 sm:p-6 bg-[#F8F5EE] border-t border-stone-200/80 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-stone-500">
            Export official statement formatted for tax submission, audits, and personal accounting.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200/90 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-amber-600" />
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-orange-500/25 cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              Download / Print PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
