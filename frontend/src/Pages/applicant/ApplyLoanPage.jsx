import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useUser } from '@clerk/react'
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
  ArrowRight,
  Trash2
} from 'lucide-react'
import {
  saveDraftApplication,
  submitNewApplication,
  getApplicationById,
  uploadDocumentFile
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
  const { user } = useUser()
  const [searchParams] = useSearchParams()
  const resumeId = searchParams.get('resume')
  const reapplyId = searchParams.get('reapplyFrom')

  const [currentStep, setCurrentStep] = useState(1)
  const [draftId, setDraftId] = useState(resumeId || null)
  const [loadingDraft, setLoadingDraft] = useState(!!resumeId || !!reapplyId)
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  // Step 1: Personal Details
  const [personalDetails, setPersonalDetails] = useState({
    fullName: '',
    email: '',
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

  // Auto-fill user email and name if available ONCE on load
  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (hasInitializedRef.current) return

    const userEmail =
      user?.primaryEmailAddress?.emailAddress ||
      (typeof window !== 'undefined'
        ? sessionStorage.getItem('lms_user_email') || localStorage.getItem('lms_user_email')
        : '')
    const userName =
      user?.fullName ||
      (typeof window !== 'undefined'
        ? sessionStorage.getItem('lms_user_name') || localStorage.getItem('lms_user_name')
        : '')

    if (userEmail || userName) {
      hasInitializedRef.current = true
      setPersonalDetails((prev) => ({
        ...prev,
        fullName: prev.fullName || userName || '',
        email: prev.email || userEmail || ''
      }))
    }
  }, [user?.id, user?.primaryEmailAddress?.emailAddress, user?.fullName])

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

  // Step 4: Documents (Starts empty so only genuinely uploaded documents appear)
  const [documents, setDocuments] = useState([])

  // Resume Draft Loader or Re-Apply Pre-fill
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
    } else if (reapplyId) {
      setLoadingDraft(true)
      getApplicationById(reapplyId).then((app) => {
        if (app) {
          // Pre-populate previous verified details, but start fresh as step 2 (Loan selection) with no draft ID
          setDraftId(null)
          setCurrentStep(2)
          if (app.personalDetails) setPersonalDetails((prev) => ({ ...prev, ...app.personalDetails }))
          if (app.incomeDetails) setIncomeDetails((prev) => ({ ...prev, ...app.incomeDetails }))
          if (app.loanDetails) setLoanDetails((prev) => ({ ...prev, ...app.loanDetails, amount: Math.round(Number(app.loanDetails.amount || 300000) * 0.8) }))
          if (app.documents && app.documents.length) setDocuments(app.documents)
          setStatusMessage({
            type: 'info',
            text: `Re-applying: Pre-filled your profile from previous application ${app.applicationNumber}. Adjust your loan amount or tenure below.`
          })
        }
        setLoadingDraft(false)
      })
    }
  }, [resumeId, reapplyId])

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
      const activeEmail =
        personalDetails.email ||
        user?.primaryEmailAddress?.emailAddress ||
        (typeof window !== 'undefined'
          ? sessionStorage.getItem('lms_user_email') || localStorage.getItem('lms_user_email')
          : '')

      const draft = await saveDraftApplication({
        _id: draftId,
        currentStep,
        applicantEmail: activeEmail,
        personalDetails: {
          ...personalDetails,
          email: activeEmail
        },
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

    // Validate mandatory documents: require genuine uploads
    const hasId = documents.some((d) => d.documentType === 'id_proof')
    const hasIncome = documents.some((d) => d.documentType === 'income_proof')
    if (!hasId || !hasIncome) {
      setStatusMessage({
        type: 'error',
        text: 'Please upload both Identity Proof (PAN / Aadhaar) and Income Proof before final submission.'
      })
      return
    }

    setSubmitting(true)
    try {
      const activeEmail =
        personalDetails.email ||
        user?.primaryEmailAddress?.emailAddress ||
        (typeof window !== 'undefined'
          ? sessionStorage.getItem('lms_user_email') || localStorage.getItem('lms_user_email')
          : '')

      const application = await submitNewApplication({
        _id: draftId,
        applicantEmail: activeEmail,
        personalDetails: {
          ...personalDetails,
          email: activeEmail
        },
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

  const [uploadingType, setUploadingType] = useState(null)

  // Real File Upload Handler (PDF, JPEG, PNG)
  const handleRealFileUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingType(type)
    setStatusMessage(null)

    try {
      const uploadedDoc = await uploadDocumentFile(file, type)
      setDocuments((prev) => [
        ...prev.filter((d) => d.documentType !== type),
        uploadedDoc
      ])
      setStatusMessage({
        type: 'success',
        text: `Document "${file.name}" uploaded successfully for ${type === 'id_proof' ? 'ID Proof' : 'Income Proof'}!`
      })
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to upload document' })
    } finally {
      setUploadingType(null)
      e.target.value = ''
    }
  }

  // Remove Document Handler
  const handleRemoveDocument = (type) => {
    setDocuments((prev) => prev.filter((d) => d.documentType !== type))
    setStatusMessage({
      type: 'info',
      text: `Removed ${type === 'id_proof' ? 'Identity Proof' : 'Income Proof'}. You can upload a new file anytime.`
    })
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-stone-200/80 p-6 sm:p-8 rounded-3xl shadow-md shadow-stone-200/40">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-50/90 text-amber-900 border border-amber-200/80 mb-2 shadow-xs">
            <span>🍃</span>
            <span>Digital Credit Application</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#3A1700] tracking-tight">Apply for a New Loan</h1>
          <p className="text-xs sm:text-sm text-[#5C3D2E] mt-1 leading-relaxed">
            Complete the 4-step verified workflow with instant EMI preview and save-as-draft support.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-stone-200/90 bg-[#F8F5EE] hover:bg-[#F0ECE2] text-stone-800 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-amber-700" />
            {savingDraft ? 'Saving...' : 'Save Draft'}
          </button>
          <Link
            to="/applicant"
            className="px-4 py-2.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition"
          >
            My Applications
          </Link>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm flex items-center gap-3 shadow-xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : statusMessage.type === 'info'
              ? 'bg-amber-50 text-amber-900 border border-amber-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <div>{statusMessage.text}</div>
        </div>
      )}

      {/* Multi-Step Stepper Header */}
      <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
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
                    ? 'border-amber-500 bg-amber-50/60 shadow-xs ring-2 ring-amber-500/20'
                    : isCompleted
                    ? 'border-amber-200 bg-[#F8F5EE]'
                    : 'border-stone-200 hover:border-stone-300 bg-white'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                    isCurrent
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
                      : isCompleted
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.number}
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">Step {s.number}</span>
                  <span className="text-xs font-bold text-stone-800 truncate block">{s.title}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step Form Body */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-md shadow-stone-200/40">
        {/* STEP 1: PERSONAL DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="border-b border-stone-100 pb-4">
              <h2 className="text-lg font-bold text-[#3A1700]">Step 1: Personal Details</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Provide your identification information matching your government ID.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kushal Patel"
                  value={personalDetails.fullName}
                  onChange={(e) => setPersonalDetails({ ...personalDetails, fullName: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. kushal@example.com"
                  value={personalDetails.email || ''}
                  onChange={(e) => setPersonalDetails({ ...personalDetails, email: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={personalDetails.dateOfBirth}
                  onChange={(e) => setPersonalDetails({ ...personalDetails, dateOfBirth: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">PAN Card / Tax ID Number *</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="e.g. ABCDE1234F"
                  value={personalDetails.panNumber}
                  onChange={(e) => setPersonalDetails({ ...personalDetails, panNumber: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <span className="text-[10px] text-stone-400">Standard Indian 10-digit PAN format</span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Contact Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={personalDetails.phone}
                  onChange={(e) => setPersonalDetails({ ...personalDetails, phone: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-1 pt-2">
                <label className="font-semibold text-stone-700">Residential Street Address *</label>
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
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">City *</label>
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
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">State *</label>
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
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Postal / PIN Code *</label>
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
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Country</label>
                <input
                  type="text"
                  disabled
                  value="India"
                  className="w-full p-2.5 bg-stone-100 border border-stone-200 rounded-xl text-stone-500"
                />
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-stone-100">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-[#F8F5EE] hover:bg-[#F0ECE2] border border-stone-200/90 rounded-xl cursor-pointer"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-orange-500/25 cursor-pointer active:scale-95"
              >
                Proceed to Loan Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LOAN DETAILS & AUTO-CALCULATED EMI PREVIEW */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-stone-100 pb-4">
              <h2 className="text-lg font-bold text-[#3A1700]">Step 2: Loan Details &amp; Auto-Calculated EMI</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Select your financing type, specify tenure and amount, and inspect your real-time monthly repayment preview.
              </p>
            </div>

            {/* Loan Type Selection Cards */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wide">Select Loan Category</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {LOAN_TYPES.map((t) => {
                  const isSelected = loanDetails.loanType === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectLoanType(t)}
                      className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-500 bg-white shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/20'
                          : 'border-stone-200/80 bg-white/80 hover:border-stone-300 hover:bg-white hover:shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-bold text-xs text-[#3A1700]">{t.name}</span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            {t.rate}%
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-600 leading-relaxed">{t.description}</p>
                      </div>
                      <span className="text-[10px] text-stone-400 mt-2 block font-medium">
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
              <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-stone-200/80 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-700">Principal Requested</span>
                  <span className="font-extrabold text-[#3A1700] text-sm">
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
                  className="w-full h-2 bg-stone-200 rounded-lg cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span>₹50,000</span>
                  <span>₹50,00,000</span>
                </div>
              </div>

              {/* Tenure Slider */}
              <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-stone-200/80 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-700">Repayment Tenure</span>
                  <span className="font-extrabold text-[#3A1700] text-sm">
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
                  className="w-full h-2 bg-stone-200 rounded-lg cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span>12 mos</span>
                  <span>120 mos</span>
                </div>
              </div>
            </div>

            {/* Loan Purpose */}
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-stone-700">Purpose of Loan *</label>
              <textarea
                rows={2}
                placeholder="Briefly state what the borrowed capital will be used for..."
                value={loanDetails.purpose}
                onChange={(e) => setLoanDetails({ ...loanDetails, purpose: e.target.value })}
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            {/* Live Auto-Calculated EMI Preview Card matching Home Page aesthetic */}
            <div className="bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white rounded-3xl p-6 shadow-xl border border-amber-900/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-amber-300" />
                  Auto-Calculated Amortization Preview
                </span>
                <div className="text-3xl font-black text-white mt-1">
                  ₹{monthlyEmi.toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-stone-300"> / month</span>
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  Benchmark rate: {loanDetails.interestRate}% p.a. &bull; Tenure: {loanDetails.tenureMonths} months
                </p>
              </div>

              <div className="text-left sm:text-right text-xs space-y-1.5 border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-6 w-full sm:w-auto">
                <div>
                  <span className="text-stone-300">Total Interest: </span>
                  <span className="font-bold text-amber-300">₹{totalInterest.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-stone-300">Total Repayment: </span>
                  <span className="font-extrabold text-white text-sm">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-stone-200/90 text-xs font-semibold text-stone-700 bg-[#F8F5EE] hover:bg-[#F0ECE2] rounded-xl cursor-pointer"
              >
                Back to Step 1
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-orange-500/25 cursor-pointer active:scale-95"
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
            <div className="border-b border-stone-100 pb-4">
              <h2 className="text-lg font-bold text-[#3A1700]">Step 3: Income &amp; Employment Details</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Our rule-based eligibility engine uses these metrics to evaluate Debt-to-Income (DTI) compliance.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Gross Monthly Income (₹) *</label>
                <input
                  type="number"
                  min={10000}
                  step={5000}
                  required
                  placeholder="e.g. 65000"
                  value={incomeDetails.monthlyIncome}
                  onChange={(e) => setIncomeDetails({ ...incomeDetails, monthlyIncome: Number(e.target.value) })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Employment Category *</label>
                <select
                  value={incomeDetails.employmentType}
                  onChange={(e) => setIncomeDetails({ ...incomeDetails, employmentType: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="salaried">Salaried Professional</option>
                  <option value="self_employed">Self Employed Individual</option>
                  <option value="business_owner">Business Owner / Partner</option>
                  <option value="other">Other / Freelance</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Employer / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Consultancy Services"
                  value={incomeDetails.employerName}
                  onChange={(e) => setIncomeDetails({ ...incomeDetails, employerName: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-stone-700">Existing Monthly Loan EMIs (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="e.g. 5000"
                  value={incomeDetails.existingMonthlyEmi}
                  onChange={(e) => setIncomeDetails({ ...incomeDetails, existingMonthlyEmi: Number(e.target.value) })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                  className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                    isSafe
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
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
                  <span className="font-bold text-xs px-3 py-1 rounded-full bg-white border border-stone-200 shadow-2xs">
                    {isSafe ? 'Compliant' : 'High DTI'}
                  </span>
                </div>
              )
            })()}

            <div className="flex justify-between pt-6 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 border border-stone-200/90 text-xs font-semibold text-stone-700 bg-[#F8F5EE] hover:bg-[#F0ECE2] rounded-xl cursor-pointer"
              >
                Back to Step 2
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-orange-500/25 cursor-pointer active:scale-95"
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
            <div className="border-b border-stone-100 pb-4">
              <h2 className="text-lg font-bold text-[#3A1700]">Step 4: Document Verification &amp; Final Submission</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Upload your identification and income proofs (PDF, JPEG, or PNG, max 10MB each).
              </p>
            </div>

            {/* Document Upload Sections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* ID Proof Box */}
              <div className="p-5 rounded-2xl border border-stone-200 bg-[#FFFDF9] space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#3A1700]">1. Identity Proof (Mandatory)</span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                    documents.some((d) => d.documentType === 'id_proof')
                      ? 'text-emerald-800 bg-emerald-100 border border-emerald-300'
                      : 'text-amber-800 bg-amber-100 border border-amber-300'
                  }`}>
                    {documents.some((d) => d.documentType === 'id_proof') ? 'Uploaded' : 'Missing'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Government issued PAN Card, Aadhaar Card, or Passport. (PDF, JPG, PNG)
                </p>

                {documents.find((d) => d.documentType === 'id_proof') ? (
                  <div className="pt-1 flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-[#3A1700] text-xs truncate">
                        {documents.find((d) => d.documentType === 'id_proof').fileName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 px-2 py-1 rounded-lg cursor-pointer shadow-xs">
                        Change
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={(e) => handleRealFileUpload(e, 'id_proof')}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument('id_proof')}
                        className="p-1 text-stone-400 hover:text-rose-600 transition cursor-pointer"
                        title="Remove ID Proof"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <label className="w-full py-2.5 px-3 bg-white border border-stone-300 hover:bg-stone-50 rounded-xl text-xs font-semibold text-stone-800 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      <span>{uploadingType === 'id_proof' ? 'Uploading...' : 'Choose File to Upload'}</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => handleRealFileUpload(e, 'id_proof')}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Income Proof Box */}
              <div className="p-5 rounded-2xl border border-stone-200 bg-[#FFFDF9] space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#3A1700]">2. Income Proof (Mandatory)</span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                    documents.some((d) => d.documentType === 'income_proof')
                      ? 'text-emerald-800 bg-emerald-100 border border-emerald-300'
                      : 'text-amber-800 bg-amber-100 border border-amber-300'
                  }`}>
                    {documents.some((d) => d.documentType === 'income_proof') ? 'Uploaded' : 'Missing'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Last 3 months salary slips, ITR acknowledgment, or Form 16. (PDF, JPG, PNG)
                </p>

                {documents.find((d) => d.documentType === 'income_proof') ? (
                  <div className="pt-1 flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-[#3A1700] text-xs truncate">
                        {documents.find((d) => d.documentType === 'income_proof').fileName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 px-2 py-1 rounded-lg cursor-pointer shadow-xs">
                        Change
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={(e) => handleRealFileUpload(e, 'income_proof')}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument('income_proof')}
                        className="p-1 text-stone-400 hover:text-rose-600 transition cursor-pointer"
                        title="Remove Income Proof"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <label className="w-full py-2.5 px-3 bg-white border border-stone-300 hover:bg-stone-50 rounded-xl text-xs font-semibold text-stone-800 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      <span>{uploadingType === 'income_proof' ? 'Uploading...' : 'Choose File to Upload'}</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => handleRealFileUpload(e, 'income_proof')}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* List of Attached Documents */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                Attached Files ({documents.length})
              </span>
              {documents.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-stone-200 bg-[#FFFDF9] text-center space-y-1">
                  <FileText className="w-6 h-6 text-stone-300 mx-auto mb-1" />
                  <p className="font-semibold text-stone-600 text-xs">No documents uploaded yet</p>
                  <p className="text-[11px] text-stone-400">
                    Upload your Identity Proof and Income Proof above to verify your application.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-[#FFFDF9]">
                  {documents.map((doc, idx) => (
                    <div key={idx} className="p-3.5 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-[#3A1700] block truncate">{doc.fileName}</span>
                          <span className="text-[10px] text-stone-400 uppercase font-medium">
                            {doc.documentType.replace('_', ' ')} &bull;{' '}
                            {doc.fileSize
                              ? doc.fileSize > 1048576
                                ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB`
                                : `${(doc.fileSize / 1024).toFixed(0)} KB`
                              : 'Ready'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          Ready
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDocument(doc.documentType)}
                          className="p-1 hover:bg-rose-50 text-stone-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                          title="Remove document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pre-submission Summary Review */}
            <div className="p-5 rounded-2xl bg-[#FFFDF9] border border-stone-200 text-xs space-y-2">
              <span className="font-bold text-[#3A1700] uppercase tracking-wide block">Application Summary</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-stone-500">Applicant:</span>
                  <p className="font-bold text-stone-900 mt-0.5">{personalDetails.fullName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-stone-500">Loan:</span>
                  <p className="font-bold text-stone-900 uppercase mt-0.5">
                    ₹{Number(loanDetails.amount).toLocaleString('en-IN')} ({loanDetails.loanType})
                  </p>
                </div>
                <div>
                  <span className="text-stone-500">Monthly EMI:</span>
                  <p className="font-extrabold text-amber-700 mt-0.5">₹{monthlyEmi.toLocaleString('en-IN')}/mo</p>
                </div>
                <div>
                  <span className="text-stone-500">Income:</span>
                  <p className="font-bold text-stone-900 mt-0.5">₹{Number(incomeDetails.monthlyIncome).toLocaleString('en-IN')}/mo</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 border border-stone-200 text-xs font-semibold text-stone-700 bg-[#F8F5EE] hover:bg-[#F0ECE2] rounded-xl cursor-pointer"
              >
                Back to Step 3
              </button>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handleSubmitApplication}
                  disabled={submitting}
                  className="px-7 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-orange-500/25 cursor-pointer disabled:opacity-50 active:scale-95"
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
