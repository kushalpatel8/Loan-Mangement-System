import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Show } from '@clerk/react'

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
    description: 'Instant funds for medical emergencies, weddings, travel, or debt consolidation with minimal documentation.',
    badge: 'Popular',
    color: 'blue'
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
    description: 'Low interest rates and extended tenures to help you purchase, construct, or renovate your dream home.',
    badge: 'Lowest Rate',
    color: 'emerald'
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
    description: 'Quick financing for new or pre-owned two-wheelers and four-wheelers with flexible repayment terms.',
    badge: 'Fast Disbursal',
    color: 'amber'
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
    description: 'Working capital, machinery purchase, and business expansion credit for SMEs and entrepreneurs.',
    badge: 'High Limit',
    color: 'purple'
  }
]

export default function HomePage() {
  const [selectedLoanType, setSelectedLoanType] = useState(LOAN_TYPES[0].id)
  const [amount, setAmount] = useState(LOAN_TYPES[0].defaultAmount)
  const [tenure, setTenure] = useState(LOAN_TYPES[0].defaultTenure)

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

  const principalPercent = totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 50
  const interestPercent = 100 - principalPercent

  return (
    <div className="w-full text-slate-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white py-20 px-6 sm:px-12 rounded-3xl shadow-2xl mb-16">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs sm:text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            End-to-End Credit Workflow Platform
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-6">
            Smart, Transparent &amp; Fast <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-300 bg-clip-text text-transparent">
              Loan Management System
            </span>
          </h1>
          <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Experience seamless digital lending — from automated rule-based eligibility checks and multi-stage officer reviews to final approval and dynamic EMI repayment schedules.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Show when="signed-out">
              <Link
                to="/sign-up"
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5"
              >
                Apply for Loan
              </Link>
              <Link
                to="/login"
                className="px-8 py-3.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold rounded-xl transition hover:border-slate-500"
              >
                Track Application
              </Link>
            </Show>
            <Show when="signed-in">
              <a
                href="#calculator"
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition transform hover:-translate-y-0.5"
              >
                Calculate EMI
              </a>
              <a
                href="#workflow"
                className="px-8 py-3.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold rounded-xl transition hover:border-slate-500"
              >
                View Workflow
              </a>
            </Show>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-12 border-t border-slate-800 text-left">
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-2xl sm:text-3xl font-bold text-white">8.5%</div>
              <div className="text-xs text-slate-400 mt-1">Starting Interest Rate</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-400">Instant</div>
              <div className="text-xs text-slate-400 mt-1">Rule-Based Eligibility</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-2xl sm:text-3xl font-bold text-sky-400">3-Stage</div>
              <div className="text-xs text-slate-400 mt-1">Applicant &rarr; Officer &rarr; Admin</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-2xl sm:text-3xl font-bold text-amber-400">100%</div>
              <div className="text-xs text-slate-400 mt-1">Audit Trail &amp; Transparency</div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive EMI Calculator Section */}
      <section id="calculator" className="py-8 mb-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Interactive Loan EMI Calculator
          </h2>
          <p className="text-slate-600 mt-2">
            Calculate your monthly installment, preview total interest, and plan your repayment with complete clarity.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-6 sm:p-10">
          {/* Loan Type Selector */}
          <div className="flex flex-wrap gap-2.5 mb-8 pb-6 border-b border-slate-100">
            {LOAN_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleLoanTypeChange(type)}
                className={`px-4 py-2.5 rounded-xl font-medium text-sm transition cursor-pointer ${
                  selectedLoanType === type.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {type.name} <span className="opacity-80 text-xs">({type.rate}%)</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Sliders Area */}
            <div className="lg:col-span-7 space-y-6">
              {/* Amount Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700">Loan Amount</span>
                  <span className="text-lg font-bold text-blue-600">
                    ₹{Number(amount).toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  type="range"
                  min={activeLoan.minAmount}
                  max={activeLoan.maxAmount}
                  step={10000}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>₹{activeLoan.minAmount.toLocaleString('en-IN')}</span>
                  <span>₹{activeLoan.maxAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Tenure Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-700">Tenure</span>
                  <span className="text-lg font-bold text-blue-600">
                    {tenure} Months <span className="text-xs text-slate-500">({(tenure / 12).toFixed(1)} yrs)</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={activeLoan.minTenure}
                  max={activeLoan.maxTenure}
                  step={6}
                  value={tenure}
                  onChange={(e) => setTenure(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{activeLoan.minTenure} months</span>
                  <span>{activeLoan.maxTenure} months</span>
                </div>
              </div>

              {/* Fixed Rate Note */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-sm">
                <div>
                  <span className="text-slate-500">Benchmark Interest Rate:</span>
                  <span className="ml-2 font-bold text-slate-800">{activeLoan.rate}% p.a.</span>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700">
                  {activeLoan.badge}
                </span>
              </div>
            </div>

            {/* Result Card */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xl">
              <div>
                <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
                  Monthly Repayment
                </span>
                <div className="text-4xl font-extrabold text-emerald-400 mt-2 mb-6">
                  ₹{monthlyEmi.toLocaleString('en-IN')}
                  <span className="text-sm font-normal text-slate-300"> / month</span>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-800 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Principal Amount:</span>
                    <span className="font-semibold text-white">₹{Number(amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Interest Payable:</span>
                    <span className="font-semibold text-amber-400">₹{totalInterest.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-800">
                    <span className="text-slate-200">Total Payable Amount:</span>
                    <span className="text-white">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Progress Visual */}
                <div className="mt-6">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div style={{ width: `${principalPercent}%` }} className="bg-blue-500 h-full" title={`Principal: ${principalPercent}%`}></div>
                    <div style={{ width: `${interestPercent}%` }} className="bg-amber-400 h-full" title={`Interest: ${interestPercent}%`}></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Principal ({principalPercent}%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span> Interest ({interestPercent}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link
                  to="/sign-up"
                  className="block text-center w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition shadow-md"
                >
                  Apply with this Plan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Loan Products Grid */}
      <section className="py-8 mb-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Tailored Loan Products
          </h2>
          <p className="text-slate-600 mt-2">
            Choose from flexible financing products designed to support your personal goals and business growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {LOAN_TYPES.map((loan) => (
            <div
              key={loan.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700 transition">
                    {loan.badge}
                  </span>
                  <span className="text-lg font-bold text-slate-900">{loan.rate}%</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{loan.name}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">{loan.description}</p>

                <div className="space-y-2 py-4 border-t border-slate-100 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max Limit:</span>
                    <span className="font-semibold">₹{(loan.maxAmount / 100000).toFixed(1)} Lakhs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tenure:</span>
                    <span className="font-semibold">Up to {loan.maxTenure} months</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    handleLoanTypeChange(loan)
                    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="w-full py-2.5 text-center text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-xl transition cursor-pointer"
                >
                  Configure &amp; Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Multi-Stage Credit Workflow Section */}
      <section id="workflow" className="py-12 px-6 sm:px-12 bg-slate-50 border border-slate-200 rounded-3xl mb-16">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Enterprise Credit Workflow</span>
          <h2 className="text-3xl font-bold text-slate-900 mt-2">How Correm LMS Works</h2>
          <p className="text-slate-600 mt-2">
            A secure, role-governed journey from application draft to final repayment schedule.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-4">
              1
            </div>
            <h4 className="font-bold text-slate-900 mb-1">Multi-Step Form</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Applicant submits personal, income, loan details and uploads identity &amp; salary proofs. Includes save-as-draft support.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm mb-4">
              2
            </div>
            <h4 className="font-bold text-slate-900 mb-1">Eligibility Engine</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Automated deterministic rules evaluate income-to-loan ratios, minimum age, and document checks with instant pass/fail insights.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-sm mb-4">
              3
            </div>
            <h4 className="font-bold text-slate-900 mb-1">Officer Review</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Loan officer reviews documentation, requests additional information, or recommends approval/rejection with notes.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm mb-4">
              4
            </div>
            <h4 className="font-bold text-slate-900 mb-1">Admin &amp; EMI Schedule</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Admin gives final sign-off. Approved loans generate full amortization tables (principal, interest, balance, due dates).
            </p>
          </div>
        </div>
      </section>

      {/* Role-Based Overview Grid */}
      <section className="py-8 mb-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Designed for Every Stakeholder
          </h2>
          <p className="text-slate-600 mt-2">
            Unified access governance across Applicants, Loan Officers, and System Administrators.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="text-blue-600 font-bold text-sm uppercase tracking-wide mb-2">Role 01</div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Applicant Portal</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">&bull; Apply for Personal, Home, Vehicle or Business loans</li>
              <li className="flex items-center gap-2">&bull; Upload ID proofs and income statements</li>
              <li className="flex items-center gap-2">&bull; Track real-time timeline (Draft &rarr; Review &rarr; Approved)</li>
              <li className="flex items-center gap-2">&bull; View full repayment EMI schedule</li>
            </ul>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="text-indigo-600 font-bold text-sm uppercase tracking-wide mb-2">Role 02</div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Loan Officer Desk</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">&bull; Review incoming queue of loan submissions</li>
              <li className="flex items-center gap-2">&bull; Inspect applicant documents &amp; verify KYC</li>
              <li className="flex items-center gap-2">&bull; Trigger rule-based automated eligibility check</li>
              <li className="flex items-center gap-2">&bull; Request more info or recommend approval</li>
            </ul>
          </div>

          <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="text-emerald-600 font-bold text-sm uppercase tracking-wide mb-2">Role 03</div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Admin Governance</h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">&bull; Final approve or reject with remarks</li>
              <li className="flex items-center gap-2">&bull; Complete audit trail of all decision steps</li>
              <li className="flex items-center gap-2">&bull; Manage users, roles, and system configuration</li>
              <li className="flex items-center gap-2">&bull; Mark and track individual EMI repayments</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Call to Action Footer Card */}
      <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 text-center mb-16 relative overflow-hidden">
        <h3 className="text-2xl sm:text-4xl font-bold mb-4">Ready to process or apply for credit?</h3>
        <p className="text-slate-400 max-w-xl mx-auto mb-8 text-sm sm:text-base">
          Sign up to submit your application or sign in with your role-assigned credentials to access your dashboard.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/sign-up"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl transition shadow-lg"
          >
            Get Started Now
          </Link>
          <Link
            to="/login"
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold rounded-xl transition"
          >
            Login to Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-8 pb-12 border-t border-slate-200 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Correm Advisory India Pvt. Ltd. — Loan Management System (LMS).</p>
      </footer>
    </div>
  )
}
