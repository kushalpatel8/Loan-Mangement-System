import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  User,
  CreditCard,
  Briefcase,
  FileText,
  Upload,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  AlertCircle,
  FileCheck,
  Calculator,
  ArrowRight
} from 'lucide-react'
import {
  saveDraftApplication,
  submitNewApplication,
  getApplicationById
} from '../../lib/loanWorkflowApi'

const LOAN_TYPES = [
  {
    id: 'personal',
    name: 'Personal Loan',
    rate: 12.0,
    minAmount: 50000,
    maxAmount: 1500000,
    minTenure: 12,
    maxTenure: 60,
    description: 'Instant funds for personal needs, weddings, medical expenses'
  },
  {
    id: 'home',
    name: 'Home Loan',
    rate: 8.5,
    minAmount: 500000,
    maxAmount: 10000000,
    minTenure: 36,
    maxTenure: 360,
    description: 'Competitive interest rates for residential property purchase'
  },
  {
    id: 'vehicle',
    name: 'Vehicle Loan',
    rate: 9.5,
    minAmount: 100000,
    maxAmount: 3000000,
    minTenure: 12,
    maxTenure: 84,
    description: 'Financing for brand-new or pre-owned vehicles'
  },
  {
    id: 'business',
    name: 'Business Loan',
    rate: 14.0,
    minAmount: 200000,
    maxAmount: 5000000,
    minTenure: 12,
    maxTenure: 60,
    description: 'Working capital and capital expenditure credit for businesses'
  }
]

export default function ApplyLoanPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resumeId = searchParams.get('resume')

  const [currentStep, setCurrentStep] = useState(1)
  const [draftId, setDraftId] = useState(resumeId || null)
  const [loadingDraft, setLoadingDraft] = useState(!!resumeId)
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  // Step 1: Personal Details
  const [personalDetails, setPersonalDetails] = useState({
    fullName: '',
    dateOfBirth: '',
    panNumber: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India'
    }
  })

  // Step 2: Loan Details
  const [loanDetails, setLoanDetails] = useState({
    loanType: 'personal',
    amount: 300000,
    tenureMonths: 24,
    interestRate: 12.0,
    purpose: ''
  })

  // Step 3: Income Details
  const [incomeDetails, setIncomeDetails] = useState({
    monthlyIncome: 60000,
    employmentType: 'salaried',
    employerName: '',
    existingMonthlyEmi: 0
  })

  // Step 4: Documents
  const [documents, setDocuments] = useState([
    {
      documentType: 'id_proof',
      fileName: 'PAN_Card.pdf',
      fileSize: 1250000,
      fileUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800'
    },
    {
      documentType: 'income_proof',
      fileName: 'Salary_Slips_Last3Months.pdf',
      fileSize: 2400000,
      fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800'
    }
  ])

  // Resume Draft Loader
  useEffect(() => {
    if (resumeId) {
      setLoadingDraft(true)
      getApplicationById(resumeId).then((app) => {
        if (app) {
          setDraftId(app._id)
          setCurrentStep(app.currentStep || 1)
          if (app.personalDetails) setPersonalDetails((prev) => ({ ...prev, ...app.personalDetails }))
          if (app.loanDetails) setLoanDetails((prev) => ({ ...prev, ...app.loanDetails }))
          if (app.incomeDetails) setIncomeDetails((prev) => ({ ...prev, ...app.incomeDetails }))
          if (app.documents && app.documents.length) setDocuments(app.documents)
          setStatusMessage({ type: 'info', text: `Resumed draft application ${app.applicationNumber} at Step ${app.currentStep || 1}` })
        }
        setLoadingDraft(false)
      })
    }
  }, [resumeId])

  // Auto-calculated EMI Preview: E = P * r * (1 + r)^n / ((1 + r)^n - 1)
  const { monthlyEmi, totalInterest, totalAmount } = useMemo(() => {
    const P = Number(loanDetails.amount) || 0
    const annualRate = Number(loanDetails.interestRate) || 12.0
    const n = Number(loanDetails.tenureMonths) || 12
    const r = annualRate / 12 / 100

    if (P <= 0 || n <= 0) return { monthlyEmi: 0, totalInterest: 0, totalAmount: 0 }
    if (r === 0) return { monthlyEmi: Math.round(P / n), totalInterest: 0, totalAmount: P }

    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const total = emi * n
    return {
      monthlyEmi: Math.round(emi),
      totalInterest: Math.round(total - P),
      totalAmount: Math.round(total)
    }
  }, [loanDetails.amount, loanDetails.tenureMonths, loanDetails.interestRate])

  // Handle Loan Type Selection
  const handleSelectLoanType = (type) => {
    setLoanDetails((prev) => ({
      ...prev,
      loanType: type.id,
      interestRate: type.rate,
      amount: Math.min(Math.max(prev.amount, type.minAmount), type.maxAmount),
      tenureMonths: Math.min(Math.max(prev.tenureMonths, type.minTenure), type.maxTenure)
    }))
  }

  // Save-as-Draft action
  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
      const draft = await saveDraftApplication({
        _id: draftId,
        currentStep,
        personalDetails,
        loanDetails: {
          ...loanDetails,
          monthlyEmiPreview: monthlyEmi
        },
        incomeDetails,
        documents
      })
      setDraftId(draft._id)
      setStatusMessage({
        type: 'success',
        text: `Draft saved successfully! You can resume application ${draft.applicationNumber} anytime.`
      })
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save draft' })
    } finally {
      setSavingDraft(false)
    }
  }

  // Final Application Submission
  const handleSubmitApplication = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const application = await submitNewApplication({
        _id: draftId,
        personalDetails,
        loanDetails: {
          ...loanDetails,
          monthlyEmiPreview: monthlyEmi
        },
        incomeDetails,
        documents
      })

      navigate('/applicant?submitted=true')
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to submit application' })
      setSubmitting(false)
    }
  }

  // File Upload Simulator
  const handleSimulateUpload = (type) => {
    const fileName = type === 'id_proof' ? 'Passport_Scan.pdf' : 'Bank_Statement_6Months.pdf'
    setDocuments((prev) => [
      ...prev.filter((d) => d.documentType !== type),
      {
        documentType: type,
        fileName,
        fileSize: 1800000,
        fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800'
      }
    ])
  }

  const steps = [
    { number: 1, title: 'Personal Details', icon: User },
    { number: 2, title: 'Loan & EMI Preview', icon: CreditCard },
    { number: 3, title: 'Income & Employment', icon: Briefcase },
    { number: 4, title: 'Documents & Submit', icon: FileCheck }
  ]

  if (loadingDraft) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm">
        Resuming your saved loan application draft...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            Digital Credit Application Form
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Apply for a New Loan</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete the 4-step verified workflow with instant EMI preview and save-as-draft support.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {savingDraft ? 'Saving...' : 'Save Draft'}
          </button>
          <Link
            to="/applicant"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
          >
            My Applications
          </Link>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm flex items-center gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMessage.type === 'info'
              ? 'bg-blue-50 text-blue-800 border border-blue-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <div>{statusMessage.text}</div>
        </div>
      )}

      {/* Multi-Step Stepper Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {steps.map((s) => {
            const Icon = s.icon
            const isCompleted = currentStep > s.number
            const isCurrent = currentStep === s.number
            return (
              <button
                key={s.number}
                type="button"
                onClick={() => setCurrentStep(s.number)}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/50'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.number}
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Step {s.number}</span>
                  <span className="text-xs font-bold text-slate-800 truncate block">{s.title}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step Form Body */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* STEP 1: PERSONAL DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Step 1: Personal Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Provide your identification information matching your government ID.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kushal Patel"
                  value={personalDetails.fullName}
                  onChange={(e) => setPersonalDetails({ ...personalDetails, fullName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={personalDetails.dateOfBirth}
                  onChange={(e) => setPersonalDetails({ ...personalDetails, dateOfBirth: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">PAN Card / Tax ID Number *</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="e.g. ABCDE1234F"
                  value={personalDetails.panNumber}
                  onChange={(e) => setPersonalDetails({ ...personalDetails, panNumber: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="text-[10px] text-slate-400">Standard Indian 10-digit PAN format</span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Contact Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={personalDetails.phone}
                  onChange={(e) => setPersonalDetails({ ...personalDetails, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="sm:col-span-2 space-y-1 pt-2">
                <label className="font-semibold text-slate-700">Residential Street Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 402, Green Glen Heights, Outer Ring Rd"
                  value={personalDetails.address?.street}
                  onChange={(e) =>
                    setPersonalDetails({
                      ...personalDetails,
                      address: { ...personalDetails.address, street: e.target.value }
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">City *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bengaluru"
                  value={personalDetails.address?.city}
                  onChange={(e) =>
                    setPersonalDetails({
                      ...personalDetails,
                      address: { ...personalDetails.address, city: e.target.value }
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">State *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karnataka"
                  value={personalDetails.address?.state}
                  onChange={(e) =>
                    setPersonalDetails({
                      ...personalDetails,
                      address: { ...personalDetails.address, state: e.target.value }
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Postal / PIN Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 560103"
                  value={personalDetails.address?.postalCode}
                  onChange={(e) =>
                    setPersonalDetails({
                      ...personalDetails,
                      address: { ...personalDetails.address, postalCode: e.target.value }
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Country</label>
                <input
                  type="text"
                  disabled
                  value="India"
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500"
                />
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              >
                Proceed to Loan Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LOAN DETAILS & AUTO-CALCULATED EMI PREVIEW */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Step 2: Loan Details &amp; Auto-Calculated EMI</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select your financing type, specify tenure and amount, and inspect your real-time monthly repayment preview.
              </p>
            </div>

            {/* Loan Type Selection Cards */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Select Loan Category</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {LOAN_TYPES.map((t) => {
                  const isSelected = loanDetails.loanType === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectLoanType(t)}
                      className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-xs text-slate-900">{t.name}</span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            {t.rate}%
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{t.description}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-2 block">
                        Tenure up to {t.maxTenure} mos
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sliders & Numerical Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Amount Slider */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Principal Requested</span>
                  <span className="font-bold text-blue-700 text-sm">
                    ₹{Number(loanDetails.amount).toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  type="range"
                  min={50000}
                  max={5000000}
                  step={25000}
                  value={loanDetails.amount}
                  onChange={(e) => setLoanDetails({ ...loanDetails, amount: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>₹50,000</span>
                  <span>₹50,00,000</span>
                </div>
              </div>

              {/* Tenure Slider */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Repayment Tenure</span>
                  <span className="font-bold text-blue-700 text-sm">
                    {loanDetails.tenureMonths} Months ({((loanDetails.tenureMonths || 12) / 12).toFixed(1)} yrs)
                  </span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={120}
                  step={6}
                  value={loanDetails.tenureMonths}
                  onChange={(e) => setLoanDetails({ ...loanDetails, tenureMonths: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-200 rounded-lg cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>12 mos</span>
                  <span>120 mos</span>
                </div>
              </div>
            </div>

            {/* Loan Purpose */}
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-slate-700">Purpose of Loan *</label>
              <textarea
                rows={2}
                placeholder="Briefly state what the borrowed capital will be used for..."
                value={loanDetails.purpose}
                onChange={(e) => setLoanDetails({ ...loanDetails, purpose: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Live Auto-Calculated EMI Preview Card */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                  Auto-Calculated Amortization Preview
                </span>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                  ₹{monthlyEmi.toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-slate-300"> / month</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Benchmark rate: {loanDetails.interestRate}% p.a. &bull; Tenure: {loanDetails.tenureMonths} months
                </p>
              </div>

              <div className="text-left sm:text-right text-xs space-y-1 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6 w-full sm:w-auto">
                <div>
                  <span className="text-slate-400">Total Interest: </span>
                  <span className="font-bold text-amber-400">₹{totalInterest.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400">Total Repayment: </span>
                  <span className="font-bold text-white">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
              >
                Back to Step 1
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  Proceed to Income Details <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: INCOME DETAILS */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Step 3: Income &amp; Employment Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Our rule-based eligibility engine uses these metrics to evaluate Debt-to-Income (DTI) compliance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Gross Monthly Income (₹) *</label>
                <input
                  type="number"
                  min={10000}
                  step={5000}
                  required
                  placeholder="e.g. 65000"
                  value={incomeDetails.monthlyIncome}
                  onChange={(e) => setIncomeDetails({ ...incomeDetails, monthlyIncome: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Employment Category *</label>
                <select
                  value={incomeDetails.employmentType}
                  onChange={(e) => setIncomeDetails({ ...incomeDetails, employmentType: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                >
                  <option value="salaried">Salaried Professional</option>
                  <option value="self_employed">Self Employed Individual</option>
                  <option value="business_owner">Business Owner / Partner</option>
                  <option value="other">Other / Freelance</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Employer / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Consultancy Services"
                  value={incomeDetails.employerName}
                  onChange={(e) => setIncomeDetails({ ...incomeDetails, employerName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Existing Monthly Loan EMIs (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="e.g. 5000"
                  value={incomeDetails.existingMonthlyEmi}
                  onChange={(e) => setIncomeDetails({ ...incomeDetails, existingMonthlyEmi: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Estimated DTI Ratio Callout */}
            {(() => {
              const income = Number(incomeDetails.monthlyIncome) || 0
              const totalCommitment = (Number(incomeDetails.existingMonthlyEmi) || 0) + monthlyEmi
              const dti = income > 0 ? (totalCommitment / income) * 100 : 0
              const isSafe = dti <= 50

              return (
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                    isSafe
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <span className="font-bold">Estimated Debt-to-Income (DTI) Ratio: {dti.toFixed(1)}%</span>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        {isSafe
                          ? 'Healthy ratio! Our credit policy permits DTI up to 50%.'
                          : 'High DTI ratio! It exceeds 50%, which may trigger officer review remarks.'}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-xs px-2.5 py-1 rounded bg-white border">
                    {isSafe ? 'Compliant' : 'High DTI'}
                  </span>
                </div>
              )
            })()}

            <div className="flex justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
              >
                Back to Step 2
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  Proceed to Documents <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: DOCUMENT UPLOAD & SUBMISSION PREVIEW */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Step 4: Document Verification &amp; Final Submission</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload your identification and income proofs (PDF, JPEG, or PNG, max 10MB each).
              </p>
            </div>

            {/* Document Upload Sections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* ID Proof Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">1. Identity Proof (Mandatory)</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                    {documents.some((d) => d.documentType === 'id_proof') ? 'Uploaded' : 'Missing'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Government issued PAN Card, Aadhaar Card, or Passport.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleSimulateUpload('id_proof')}
                    className="w-full py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Attach / Replace ID Proof
                  </button>
                </div>
              </div>

              {/* Income Proof Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">2. Income Proof (Mandatory)</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                    {documents.some((d) => d.documentType === 'income_proof') ? 'Uploaded' : 'Missing'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Last 3 months salary slips, ITR acknowledgment, or Form 16.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleSimulateUpload('income_proof')}
                    className="w-full py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Attach / Replace Income Proof
                  </button>
                </div>
              </div>
            </div>

            {/* List of Attached Documents */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Attached Files ({documents.length})
              </span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {documents.map((doc, idx) => (
                  <div key={idx} className="p-3 bg-slate-50/40 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800 block">{doc.fileName}</span>
                        <span className="text-[10px] text-slate-400 uppercase">
                          {doc.documentType.replace('_', ' ')} &bull; {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>
                    </div>
                    <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded">
                      Ready
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pre-submission Summary Review */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-800 uppercase tracking-wide block">Application Summary</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-slate-500">Applicant:</span>
                  <p className="font-semibold text-slate-800">{personalDetails.fullName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Loan:</span>
                  <p className="font-semibold text-slate-800 uppercase">
                    ₹{Number(loanDetails.amount).toLocaleString('en-IN')} ({loanDetails.loanType})
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Monthly EMI:</span>
                  <p className="font-bold text-emerald-700">₹{monthlyEmi.toLocaleString('en-IN')}/mo</p>
                </div>
                <div>
                  <span className="text-slate-500">Income:</span>
                  <p className="font-semibold text-slate-800">₹{Number(incomeDetails.monthlyIncome).toLocaleString('en-IN')}/mo</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
              >
                Back to Step 3
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handleSubmitApplication}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submitting ? 'Submitting Application...' : 'Submit Final Application'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
