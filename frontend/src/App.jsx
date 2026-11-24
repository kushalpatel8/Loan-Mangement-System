import { useState, useCallback } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Show, UserButton } from '@clerk/react'
import SignInPage from './Pages/auth/SignInPage'
import SignUpPage from './Pages/auth/SignUpPage'
import LoginPage from './Pages/auth/LoginPage'
import RoleSelectionPage from './Pages/auth/RoleSelectionPage'
import HomePage from './Pages/homePage'
import OfficerPage from './Pages/officer/OfficerPage'
import AdminPage from './Pages/admin/AdminPage'
import ApplicantDashboard from './Pages/applicant/ApplicantDashboard'
import ApplyLoanPage from './Pages/applicant/ApplyLoanPage'
import UserSync from './components/UserSync'

function App() {
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const storedRole = sessionStorage.getItem('lms_user_role')
      const roleSelected = sessionStorage.getItem('lms_role_selected') === 'true'
      if (storedRole && roleSelected) {
        return { role: storedRole, roleSelected: true }
      }
    } catch (e) {}
    return null
  })

  const handleUserSynced = useCallback((user) => {
    if (!user) return
    setCurrentUser((prev) => {
      if (prev?.role === user.role && prev?.roleSelected === user.roleSelected) {
        return prev
      }
      return user
    })
  }, [])

  const roleBadge = () => {
    if (!currentUser || !currentUser.roleSelected) return null
    const map = {
      applicant: { label: 'Applicant', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
      loan_officer: { label: 'Loan Officer', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      admin: { label: 'Admin', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    }
    const meta = map[currentUser.role] || { label: currentUser.role, color: 'bg-slate-100 text-slate-700 border-slate-200' }
    return (
      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${meta.color} tracking-wider`}>
        {meta.label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-stone-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Background Clerk User to MongoDB synchronizer & Role Checker */}
      <UserSync onUserSynced={handleUserSynced} />

      {/* Top Navigation Bar matching the image */}
      <header className="sticky top-0 z-50 bg-[#FFFDF9]/80 backdrop-blur-md border-b border-stone-200/60">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex justify-between items-center">
          {/* Logo with rounded icon container */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-rose-500 to-indigo-600 p-[2px] shadow-sm">
              <div className="w-full h-full bg-[#1A1A2E] rounded-[10px] flex items-center justify-center text-white text-base font-black">
                ✦
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-[#2B1B17] font-serif uppercase">
                CORREM
              </span>
            </div>
          </Link>

          {/* Center Navigation Links (Role-specific direct routing) */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
            <Link
              to="/"
              className={`hover:text-amber-700 transition ${location.pathname === '/' ? 'text-amber-700 font-bold' : ''}`}
            >
              Home
            </Link>

            {/* Direct route for Applicant */}
            {currentUser?.role === 'applicant' && (
              <>
                <Link
                  to="/applicant"
                  className={`hover:text-amber-700 transition flex items-center gap-1.5 ${
                    location.pathname === '/applicant' ? 'text-amber-700 font-bold' : ''
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  My Applications
                </Link>
                <Link
                  to="/applicant/apply"
                  className={`hover:text-amber-700 transition flex items-center gap-1.5 ${
                    location.pathname === '/applicant/apply' ? 'text-amber-700 font-bold' : ''
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Apply Loan
                </Link>
              </>
            )}

            {/* Direct route for Loan Officer */}
            {currentUser?.role === 'loan_officer' && (
              <Link
                to="/officer"
                className={`hover:text-amber-700 transition flex items-center gap-1.5 ${
                  location.pathname.startsWith('/officer') ? 'text-amber-700 font-bold' : ''
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Officer Queue
              </Link>
            )}

            {/* Direct route for Administrator */}
            {currentUser?.role === 'admin' && (
              <Link
                to="/admin"
                className={`hover:text-amber-700 transition flex items-center gap-1.5 ${
                  location.pathname.startsWith('/admin') ? 'text-amber-700 font-bold' : ''
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Admin Desk
              </Link>
            )}

            {/* If user is signed in but hasn't selected a role yet */}
            {currentUser && !currentUser.roleSelected && (
              <Link
                to="/select-role"
                className={`hover:text-amber-700 transition flex items-center gap-1.5 ${
                  location.pathname === '/select-role' ? 'text-amber-600 font-bold' : 'text-amber-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Select Role
              </Link>
            )}

            <a href="/#calculator" className="hover:text-amber-700 transition">
              EMI Calculator
            </a>
          </div>

          {/* Auth Controls matching the design image */}
          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <Link
                to="/sign-in"
                className="px-5 py-2 text-sm font-semibold text-stone-700 bg-white/70 hover:bg-white border border-stone-200/80 rounded-full transition shadow-xs"
              >
                Sign In
              </Link>
              <Link
                to="/sign-up"
                className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-full shadow-md shadow-orange-500/25 transition active:scale-95"
              >
                Get Started
              </Link>
            </Show>

            <Show when="signed-in">
              <div className="flex items-center gap-3">
                {roleBadge()}
                <UserButton afterSignOutUrl="/" />
              </div>
            </Show>
          </div>
        </nav>
      </header>

      {/* Main Page Content with Warm Ambient Glow Background */}
      <main className="flex-1 w-full relative">
        {/* Soft background ambient gradient glow blobs matching Home Page */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[620px] pointer-events-none -z-10 opacity-60">
          <div className="absolute top-4 left-1/4 w-96 h-96 bg-gradient-to-tr from-amber-200/50 via-rose-200/40 to-orange-100/30 rounded-full blur-3xl transform -translate-y-12"></div>
          <div className="absolute top-12 right-1/4 w-96 h-96 bg-gradient-to-bl from-pink-200/40 via-amber-100/50 to-orange-200/40 rounded-full blur-3xl transform translate-x-12"></div>
          <div className="absolute top-28 left-1/2 -translate-x-1/2 w-[600px] h-80 bg-gradient-to-b from-amber-100/40 via-rose-100/30 to-transparent rounded-full blur-2xl"></div>
        </div>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/select-role" element={<RoleSelectionPage onRoleSelected={handleUserSynced} />} />
          <Route path="/applicant" element={<div className="max-w-7xl mx-auto px-4 py-8"><ApplicantDashboard /></div>} />
          <Route path="/applicant/apply" element={<div className="max-w-7xl mx-auto px-4 py-8"><ApplyLoanPage /></div>} />
          <Route path="/officer/*" element={<div className="max-w-7xl mx-auto px-4 py-8"><OfficerPage /></div>} />
          <Route path="/admin/*" element={<div className="max-w-7xl mx-auto px-4 py-8"><AdminPage /></div>} />
          <Route path="/sign-in/*" element={<div className="max-w-7xl mx-auto px-4 py-8"><SignInPage /></div>} />
          <Route path="/sign-up/*" element={<div className="max-w-7xl mx-auto px-4 py-8"><SignUpPage /></div>} />
          <Route path="/login/*" element={<div className="max-w-7xl mx-auto px-4 py-8"><LoginPage /></div>} />
        </Routes>
      </main>
    </div>
  )
}

export default App
