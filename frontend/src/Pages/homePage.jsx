import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Show, useUser } from '@clerk/react'

const LOAN_TYPES = [
  {
    id: 'personal',
    name: 'Personal Loan',
    rate: 12.0,
    minAmount: 50000,
    maxAmount: 1500000,
    defaultAmount: 200000,
    minTenure: 12,
    maxTenure: 60,
    defaultTenure: 24,
    description: 'Instant funds for personal goals, medical emergencies, or renovations with minimal documentation.',
    badge: 'Popular',
    tagColor: 'bg-amber-100 text-amber-900 border-amber-300'
  },
  {
    id: 'home',
    name: 'Home Loan',
    rate: 8.5,
    minAmount: 500000,
    maxAmount: 10000000,
    defaultAmount: 3500000,
    minTenure: 36,
    maxTenure: 360,
    defaultTenure: 180,
    description: 'Competitive interest rates with long tenures to purchase, construct, or renovate your dream residence.',
    badge: 'Lowest Rate',
    tagColor: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  },
  {
    id: 'vehicle',
    name: 'Vehicle Loan',
    rate: 9.5,
    minAmount: 100000,
    maxAmount: 3000000,
    defaultAmount: 600000,
    minTenure: 12,
    maxTenure: 84,
    defaultTenure: 48,
    description: 'Rapid financing for new or certified two-wheelers and four-wheelers with flexible repayment terms.',
    badge: 'Fast Disbursal',
    tagColor: 'bg-orange-100 text-orange-900 border-orange-300'
  },
  {
    id: 'business',
    name: 'Business Loan',
    rate: 14.0,
    minAmount: 200000,
    maxAmount: 5000000,
    defaultAmount: 1000000,
    minTenure: 12,
    maxTenure: 60,
    defaultTenure: 36,
    description: 'Working capital, inventory financing, and equipment upgrades tailored for scaling enterprises.',
    badge: 'High Limit',
    tagColor: 'bg-purple-100 text-purple-900 border-purple-300'
  }
]

export default function HomePage() {
  const { isSignedIn, user } = useUser()
  const navigate = useNavigate()
  const [selectedLoanType, setSelectedLoanType] = useState(LOAN_TYPES[0].id)
  const [amount, setAmount] = useState(LOAN_TYPES[0].defaultAmount)
  const [tenure, setTenure] = useState(LOAN_TYPES[0].defaultTenure)

  const handleStartJourney = () => {
    if (!isSignedIn) {
      // First time user: navigate to sign up, which will immediately prompt role selection
      navigate('/sign-up')
      return
    }

    const role = sessionStorage.getItem('lms_user_role')
    const roleSelected = sessionStorage.getItem('lms_role_selected') === 'true'

    if (!roleSelected) {
      navigate('/select-role')
    } else if (role === 'admin') {
      navigate('/admin')
    } else if (role === 'loan_officer') {
      navigate('/officer')
    } else {
      navigate('/applicant')
    }
  }

  const activeLoan = LOAN_TYPES.find((l) => l.id === selectedLoanType) || LOAN_TYPES[0]

  const handleLoanTypeChange = (loan) => {
    setSelectedLoanType(loan.id)
    setAmount(loan.defaultAmount)
    setTenure(loan.defaultTenure)
  }

  // Monthly EMI Calculation Formula: E = P * r * (1 + r)^n / ((1 + r)^n - 1)
  const { monthlyEmi, totalInterest, totalAmount } = useMemo(() => {
    const P = Number(amount) || 0
    const annualRate = activeLoan.rate
    const r = annualRate / 12 / 100
    const n = Number(tenure) || 1

    if (P <= 0 || n <= 0) {
      return { monthlyEmi: 0, totalInterest: 0, totalAmount: 0 }
    }

    if (r === 0) {
      const emi = P / n
      return { monthlyEmi: Math.round(emi), totalInterest: 0, totalAmount: P }
    }

    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    const total = emi * n
    const interest = total - P

    return {
      monthlyEmi: Math.round(emi),
      totalInterest: Math.round(interest),
      totalAmount: Math.round(total)
    }
  }, [amount, tenure, activeLoan.rate])

  return (
    <div className="w-full">
      {/* 
        HERO SECTION - Replicating the warm, ambient gradient aesthetic from the reference image:
        - Soft radial ambient glow (amber/rose/peach to warm cream)
        - Pill badge with delicate leaf icon
        - Deep rich dark-cocoa heading (#361B14 / #2B1510) with vibrant warm gradient accent
        - Generous spacing, clean line-height, balanced typography
        - Warm orange-to-amber CTA button with gentle pill style + clean neutral secondary button
        - Pill outline exploration button below
      */}
      <section className="relative overflow-hidden pt-12 pb-24 md:pt-20 md:pb-32 px-4 sm:px-6 lg:px-8">
        {/* Soft background ambient gradient glow blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[620px] pointer-events-none -z-10 opacity-70">
          <div className="absolute top-4 left-1/4 w-96 h-96 bg-gradient-to-tr from-amber-200/50 via-rose-200/40 to-orange-100/30 rounded-full blur-3xl transform -translate-y-12"></div>
          <div className="absolute top-12 right-1/4 w-96 h-96 bg-gradient-to-bl from-pink-200/40 via-amber-100/50 to-orange-200/40 rounded-full blur-3xl transform translate-x-12"></div>
          <div className="absolute top-28 left-1/2 -translate-x-1/2 w-[600px] h-80 bg-gradient-to-b from-amber-100/40 via-rose-100/30 to-transparent rounded-full blur-2xl"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center">
          {/* Top Pill Badge matching "Your Mental Health Sanctuary" */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50/90 border border-amber-200/80 shadow-xs mb-8 transition hover:bg-amber-100/80">
            <span className="text-amber-700 text-sm">🍃</span>
            <span className="text-xs sm:text-sm font-medium text-amber-900 tracking-wide">
              Your Intelligent Credit Sanctuary
            </span>
          </div>

          {/* Main Headline with dual-color typography from reference image */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#3A1700] leading-[1.12] mb-6">
            Empowerment Starts With a <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-amber-600 via-rose-600 to-orange-500 bg-clip-text text-transparent">
              Single Sanction
            </span>
          </h1>

          {/* Subtitle with soft comfortable line length */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#5C3D2E] leading-relaxed mb-10 font-normal">
            Experience a revolutionary loan management ecosystem. We blend the limitless accuracy of automated deterministic eligibility checks with the profound oversight of accredited credit officers and administrators to guide your financial ambitions.
          </p>

          {/* Primary Action Button Group matching the image layout */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6">
            <button
              onClick={handleStartJourney}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-white text-base bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25 transition transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              Start Journey
            </button>

            <Show when="signed-out">
              <Link
                to="/sign-in"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-stone-800 text-base bg-[#F8F5EE] hover:bg-[#F0ECE2] border border-stone-200/90 transition flex items-center justify-center"
              >
                Sign In
              </Link>
            </Show>

            <Show when="signed-in">
              <button
                onClick={handleStartJourney}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-stone-800 text-base bg-[#F8F5EE] hover:bg-[#F0ECE2] border border-stone-200/90 transition flex items-center justify-center cursor-pointer"
              >
                My Dashboard
              </button>
            </Show>
          </div>

          {/* Outline pill exploration button directly underneath matching reference */}
          <div className="inline-block">
            <a
              href="#calculator"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-medium text-[#7C533F] bg-white/70 hover:bg-white border border-stone-300/80 shadow-2xs transition"
            >
              <span>🌐</span>
              <span>Explore Instant EMI Simulator</span>
            </a>
          </div>
        </div>
      </section>

      {/* Main Container for Loan Products & EMI Tool */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Interactive Loan Products Tabs */}
        <section className="mb-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/70 text-amber-900 border border-amber-200 mb-3">
              ✦ Transparent Credit
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#3A1700] tracking-tight">
              Tailored Credit Products
            </h2>
            <p className="text-stone-600 text-sm sm:text-base mt-2">
              Select your loan category to configure your custom tenure and interest parameters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {LOAN_TYPES.map((loan) => {
              const isSelected = selectedLoanType === loan.id
              return (
                <div
                  key={loan.id}
                  onClick={() => handleLoanTypeChange(loan)}
                  className={`cursor-pointer rounded-2xl p-6 transition-all duration-200 border-2 relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white border-amber-500 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/20'
                      : 'bg-white/80 border-stone-200 hover:border-stone-300 hover:bg-white hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${loan.tagColor}`}>
                        {loan.badge}
                      </span>
                      <span className="text-lg font-black text-[#3A1700]">
                        {loan.rate}% <span className="text-[10px] text-stone-500 font-normal">p.a.</span>
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-stone-900 mb-2">{loan.name}</h3>
                    <p className="text-xs text-stone-600 leading-relaxed mb-4">{loan.description}</p>
                  </div>

                  <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-stone-500">Max Credit:</span>
                    <span className="font-bold text-stone-800">
                      ₹{(loan.maxAmount / 100000).toLocaleString('en-IN')} Lakhs
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Live EMI Calculator Desk */}
        <section id="calculator" className="py-12 px-6 sm:px-12 bg-white rounded-3xl border border-stone-200/80 shadow-md shadow-stone-200/40 mb-16">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Deterministic Calculation
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#3A1700] mt-3">
              Live EMI Repayment Preview
            </h2>
            <p className="text-stone-600 text-sm mt-1">
              Adjust principal and tenure to instantly preview your monthly installments and total interest obligation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Sliders Input Column */}
            <div className="lg:col-span-7 space-y-7 bg-stone-50/60 p-6 sm:p-8 rounded-2xl border border-stone-200/80">
              {/* Selected Category Summary */}
              <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                <div>
                  <span className="text-xs text-stone-500">Selected Product</span>
                  <p className="font-bold text-stone-900 text-base">{activeLoan.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-stone-500">Fixed Rate</span>
                  <p className="font-bold text-amber-700 text-base">{activeLoan.rate}% p.a.</p>
                </div>
              </div>

              {/* Loan Amount Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs sm:text-sm font-semibold text-stone-700">Loan Amount</label>
                  <div className="px-3 py-1 bg-white border border-stone-300 rounded-lg text-sm font-bold text-stone-900">
                    ₹{Number(amount).toLocaleString('en-IN')}
                  </div>
                </div>
                <input
                  type="range"
                  min={activeLoan.minAmount}
                  max={activeLoan.maxAmount}
                  step={10000}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-[11px] text-stone-400 mt-1">
                  <span>₹{(activeLoan.minAmount / 100000).toFixed(1)} L</span>
                  <span>₹{(activeLoan.maxAmount / 100000).toFixed(1)} L</span>
                </div>
              </div>

              {/* Tenure Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs sm:text-sm font-semibold text-stone-700">Repayment Tenure</label>
                  <div className="px-3 py-1 bg-white border border-stone-300 rounded-lg text-sm font-bold text-stone-900">
                    {tenure} Months ({Math.round((tenure / 12) * 10) / 10} Yrs)
                  </div>
                </div>
                <input
                  type="range"
                  min={activeLoan.minTenure}
                  max={activeLoan.maxTenure}
                  step={6}
                  value={tenure}
                  onChange={(e) => setTenure(Number(e.target.value))}
                  className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-[11px] text-stone-400 mt-1">
                  <span>{activeLoan.minTenure} Mo</span>
                  <span>{activeLoan.maxTenure} Mo</span>
                </div>
              </div>
            </div>

            {/* Results Display Column */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#2E1810] to-[#1E0F0A] text-white p-6 sm:p-8 rounded-2xl shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-amber-300/80 uppercase tracking-widest">
                  Monthly Installment
                </span>
                <div className="text-3xl sm:text-4xl font-black text-white mt-1 mb-6">
                  ₹{monthlyEmi.toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-stone-300 ml-1">/ month</span>
                </div>

                <div className="space-y-3.5 border-t border-white/10 pt-5 text-xs sm:text-sm">
                  <div className="flex justify-between text-stone-300">
                    <span>Principal Amount:</span>
                    <span className="font-bold text-white">₹{Number(amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-stone-300">
                    <span>Total Interest Charge:</span>
                    <span className="font-bold text-amber-300">₹{totalInterest.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-stone-300 border-t border-white/10 pt-3">
                    <span className="font-semibold text-stone-200">Total Payable Amount:</span>
                    <span className="font-extrabold text-white text-base">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  to="/applicant/apply"
                  className="w-full py-3 px-4 rounded-xl text-center font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-orange-500/30 transition block"
                >
                  Apply For This Loan &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 4-Step Governance Flow */}
        <section className="py-12 px-6 sm:px-12 bg-white rounded-3xl border border-stone-200/80 mb-16">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Audit-Governed Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#3A1700] mt-2">
              How The Approval Lifecycle Operates
            </h2>
            <p className="text-stone-600 text-sm mt-2">
              A transparent, rule-driven credit workflow from borrower submission to final schedule disbursal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#FFFDF9] p-6 rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm mb-4 shadow-sm">
                1
              </div>
              <h4 className="font-bold text-stone-900 mb-1 text-base">Multi-Step Form</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Applicants submit personal, loan, and income credentials, attach KYC documents, with full save-as-draft capability.
              </p>
            </div>

            <div className="bg-[#FFFDF9] p-6 rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="w-9 h-9 rounded-full bg-rose-500 text-white font-bold flex items-center justify-center text-sm mb-4 shadow-sm">
                2
              </div>
              <h4 className="font-bold text-stone-900 mb-1 text-base">Deterministic Rules</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Automated policy checks analyze age thresholds, minimum monthly earnings, and Debt-to-Income (DTI) tolerance.
              </p>
            </div>

            <div className="bg-[#FFFDF9] p-6 rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-sm mb-4 shadow-sm">
                3
              </div>
              <h4 className="font-bold text-stone-900 mb-1 text-base">Credit Officer Review</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Officers review uploaded proofs, request clarifications if needed, and recommend sanction or rejection with audit notes.
              </p>
            </div>

            <div className="bg-[#FFFDF9] p-6 rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm mb-4 shadow-sm">
                4
              </div>
              <h4 className="font-bold text-stone-900 mb-1 text-base">Admin Sanction</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Administrators make the final sanction signoff, auto-generating the complete monthly EMI repayment amortization table.
              </p>
            </div>
          </div>
        </section>

        {/* Call to Action Footer Card */}
        <section className="bg-gradient-to-r from-[#2C1810] via-[#3D2015] to-[#25120B] text-white rounded-3xl p-8 sm:p-12 text-center mb-16 relative overflow-hidden shadow-xl">
          <div className="relative z-10">
            <h3 className="text-2xl sm:text-4xl font-extrabold mb-4 tracking-tight">
              Ready to submit or review credit applications?
            </h3>
            <p className="text-stone-300 max-w-xl mx-auto mb-8 text-sm sm:text-base leading-relaxed">
              Sign up today to explore multi-step credit applications, or access your authorized portal as a Loan Officer or Administrator.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/applicant/apply"
                className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 font-bold rounded-xl text-white shadow-lg shadow-orange-500/30 transition transform active:scale-95"
              >
                Apply Now
              </Link>
              <Link
                to="/login"
                className="px-8 py-3.5 bg-white/10 hover:bg-white/15 border border-white/20 font-semibold rounded-xl text-white transition"
              >
                Sign In to Account
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 pb-12 border-t border-stone-200 text-center text-xs text-stone-500">
          <p>&copy; {new Date().getFullYear()} Correm Advisory India Pvt. Ltd. — Loan Management System (LMS).</p>
        </footer>
      </div>
    </div>
  )
}
