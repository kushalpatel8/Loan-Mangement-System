import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Show, UserButton } from '@clerk/react'
import SignInPage from './Pages/auth/SignInPage'
import SignUpPage from './Pages/auth/SignUpPage'
import LoginPage from './Pages/auth/LoginPage'
import HomePage from './Pages/homePage'
import OfficerPage from './Pages/officer/OfficerPage'
import AdminPage from './Pages/admin/AdminPage'
import ApplicantDashboard from './Pages/applicant/ApplicantDashboard'
import ApplyLoanPage from './Pages/applicant/ApplyLoanPage'

function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-lg shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition">
              L
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-slate-900 leading-tight">
                Correm LMS
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Loan Management
              </span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link
              to="/"
              className={`hover:text-blue-600 transition ${location.pathname === '/' ? 'text-blue-600 font-semibold' : ''}`}
            >
              Home
            </Link>
            <Link
              to="/applicant"
              className={`hover:text-blue-600 transition flex items-center gap-1.5 ${
                location.pathname.startsWith('/applicant') ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Applicant Desk
            </Link>
            <Link
              to="/officer"
              className={`hover:text-blue-600 transition flex items-center gap-1.5 ${
                location.pathname.startsWith('/officer') ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Officer Review
            </Link>
            <Link
              to="/admin"
              className={`hover:text-blue-600 transition flex items-center gap-1.5 ${
                location.pathname.startsWith('/admin') ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Admin Portal
            </Link>
            <a href="/#calculator" className="hover:text-blue-600 transition">
              EMI Calculator
            </a>
          </div>

          {/* Auth Controls */}
          <div className="flex items-center gap-3">
            <Link
              to="/applicant/apply"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              Apply Loan
            </Link>

            <Show when="signed-out">
              <Link
                to="/sign-in"
                className="px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Sign In
              </Link>
              <Link
                to="/login"
                className="hidden sm:inline-block px-3.5 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-lg transition"
              >
                Login
              </Link>
              <Link
                to="/sign-up"
                className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition"
              >
                Sign Up
              </Link>
            </Show>
            <Show when="signed-in">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">My Account</span>
                <UserButton afterSignOutUrl="/" />
              </div>
            </Show>
          </div>
        </nav>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/applicant" element={<ApplicantDashboard />} />
          <Route path="/applicant/apply" element={<ApplyLoanPage />} />
          <Route path="/officer/*" element={<OfficerPage />} />
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/login/*" element={<LoginPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
