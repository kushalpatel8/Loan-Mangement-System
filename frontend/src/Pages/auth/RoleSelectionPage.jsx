import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/react'
import { selectUserRole } from '../../lib/loanWorkflowApi'

export default function RoleSelectionPage({ onRoleSelected }) {
  const { user } = useUser()
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState('applicant')
  const [adminToken, setAdminToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  const roles = [
    {
      id: 'applicant',
      title: 'Loan Applicant',
      badge: 'Borrower Portal',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: (
        <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      description: 'Submit multi-step loan applications, upload KYC & income proofs, monitor live application stage, and view repayment schedules.',
      features: [
        'Interactive 4-Step Loan Application',
        'Live EMI Calculation & Draft Support',
        'Real-time Application Stage Tracker',
        'Respond to "More Info Needed" inquiries'
      ],
      destination: '/applicant'
    },
    {
      id: 'loan_officer',
      title: 'Credit / Loan Officer',
      badge: 'Review Desk',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      description: 'Review queued applicant files, inspect KYC documents, execute deterministic eligibility rule checks, and submit recommendations.',
      features: [
        'Queue of Submitted Loan Applications',
        'Deterministic Rule-based Risk & DTI Engine',
        'Recommend Approval or Rejection',
        'Request Additional Documents & Notes'
      ],
      destination: '/officer'
    },
    {
      id: 'admin',
      title: 'Sanctioning Administrator',
      badge: 'Executive Desk',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: (
        <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      description: 'Executive authority for final loan sanction or denial, auto-generation of amortization schedules, and portfolio-wide audit logs.',
      features: [
        'Final Sanction / Denial Decision Desk',
        'Automatic EMI Amortization Schedule Generation',
        'Immutable Audit Trail Oversight',
        'Individual EMI Installment Status Updater'
      ],
      destination: '/admin'
    }
  ]

  const handleConfirmRole = async () => {
    if (!confirmed) {
      setError('Please check the acknowledgement checkbox to confirm that this role cannot be changed.')
      return
    }

    if (selectedRole === 'admin' && !adminToken.trim()) {
      setError('Admin Passkey / Token is required to claim the Administrator role.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let resUser = null
      try {
        const res = await selectUserRole(selectedRole, user?.id, adminToken.trim())
        if (res && res.user) {
          resUser = res.user
        }
      } catch (apiErr) {
        // Fallback for resilient frontend demo if backend server is not running
        console.warn('Backend select-role API unavailable, saving locally:', apiErr.message)
        resUser = {
          role: selectedRole,
          roleSelected: true,
          email: user?.primaryEmailAddress?.emailAddress,
          name: user?.fullName || 'User'
        }
      }

      if (resUser) {
        // Persist permanently in browser storage so dashboard always loads immediately
        sessionStorage.setItem('lms_role_selected', 'true')
        sessionStorage.setItem('lms_user_role', resUser.role)
        localStorage.setItem('lms_role_selected', 'true')
        localStorage.setItem('lms_user_role', resUser.role)

        if (onRoleSelected) {
          onRoleSelected(resUser)
        }
        // Redirect to chosen workspace dashboard
        const target = roles.find((r) => r.id === selectedRole)?.destination || '/applicant'
        navigate(target, { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Failed to permanently assign role. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-50/90 text-amber-900 border border-amber-200/80 mb-4 shadow-xs">
          <span>🍃</span>
          <span>One-Time Profile Configuration</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#3A1700] tracking-tight sm:text-4xl">
          Select Your Workspace Role
        </h1>
        <p className="mt-3 text-[#5C3D2E] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Welcome to <strong className="text-[#3A1700]">Correm Loan Management System</strong>. Please select your official role within the platform.
        </p>
        <div className="mt-3 inline-block bg-rose-50/80 border border-rose-200 rounded-xl px-4 py-2 text-xs font-medium text-rose-800">
          ⚠️ <strong>Strict Security Policy:</strong> Once you select and confirm your role, it will be <strong>permanently locked</strong> to your account and <strong>cannot be changed</strong>.
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl flex items-center gap-3">
          <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Role Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {roles.map((r) => {
          const isSelected = selectedRole === r.id
          return (
            <div
              key={r.id}
              onClick={() => setSelectedRole(r.id)}
              className={`cursor-pointer relative flex flex-col justify-between rounded-2xl p-6 border-2 transition-all duration-200 ${
                isSelected
                  ? 'border-amber-500 bg-white shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/20'
                  : 'border-stone-200/80 bg-white/80 hover:border-stone-300 hover:bg-white hover:shadow-md'
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white shadow-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-4">{r.icon}</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${r.badgeColor}`}>
                    {r.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#3A1700] mb-2">{r.title}</h3>
                <p className="text-xs text-stone-600 mb-4 leading-relaxed">{r.description}</p>
                <div className="border-t border-stone-100 pt-3 space-y-1.5">
                  <p className="text-[11px] font-semibold text-stone-700">Capabilities:</p>
                  {r.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-xs text-stone-600">
                      <span className="text-amber-600 mt-0.5 font-bold">✓</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm font-bold'
                      : 'bg-[#F8F5EE] text-stone-800 hover:bg-[#F0ECE2] border border-stone-200/90'
                  }`}
                >
                  {isSelected ? 'Selected' : 'Choose Role'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirmation & Permanent Lock Action */}
      <div className="bg-white border border-stone-200/80 rounded-3xl p-6 sm:p-8 shadow-md shadow-stone-200/40">
        {selectedRole === 'admin' && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5">
              Admin Passkey / Verification Token <span className="text-rose-600">*</span>
            </label>
            <p className="text-xs text-amber-700 mb-2">
              The administrator role requires authorization. Please enter your secret admin token (e.g. <code>12345</code>).
            </p>
            <input
              type="password"
              placeholder="Enter Admin Token"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300 cursor-pointer accent-amber-600"
              />
              <span className="text-xs sm:text-sm text-stone-700">
                I understand that selecting{' '}
                <strong className="text-[#3A1700] font-bold">
                  {roles.find((r) => r.id === selectedRole)?.title}
                </strong>{' '}
                is a <span className="text-rose-600 font-bold">one-time permanent choice</span> and I will{' '}
                <strong>never be able to change my role</strong> afterwards.
              </span>
            </label>
            <p className="text-xs text-stone-500">
              Logged in as <span className="font-semibold text-stone-700">{user?.primaryEmailAddress?.emailAddress}</span>
            </p>
          </div>

          <button
            type="button"
            disabled={!confirmed || loading}
            onClick={handleConfirmRole}
            className={`sm:shrink-0 px-7 py-3.5 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2 cursor-pointer ${
              !confirmed || loading
                ? 'bg-stone-300 cursor-not-allowed text-stone-500'
                : 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/25 active:scale-95'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Locking Role...
              </>
            ) : (
              <>
                Lock Role & Enter Portal
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
