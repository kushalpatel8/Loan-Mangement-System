// API & State Service Connecting Frontend to Backend (/api/v1) with Clerk Authentication

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

// Helper: Retrieve Clerk Session Token & Headers
export const getAuthHeaders = async () => {
  const headers = {
    'Content-Type': 'application/json'
  }

  try {
    if (typeof window !== 'undefined' && window.Clerk?.session) {
      const token = await window.Clerk.session.getToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      if (window.Clerk.user?.primaryEmailAddress?.emailAddress) {
        headers['x-user-email'] = window.Clerk.user.primaryEmailAddress.emailAddress
      }
      if (window.Clerk.user?.fullName) {
        headers['x-user-name'] = window.Clerk.user.fullName
      }
    }
  } catch (err) {
    console.warn('Could not extract Clerk auth token:', err)
  }

  return headers
}

// 0. Synchronize Clerk User with Backend MongoDB
export const syncClerkUser = async (userData) => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/auth/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(userData)
    })
    if (res.ok) {
      const json = await res.json()
      return json.user
    }
  } catch (err) {
    console.warn('Backend syncUser unavailable, falling back:', err.message)
  }
  return null
}

// 0.1 Select and permanently lock user role
export const selectUserRole = async (role, clerkId = null, adminToken = null) => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/auth/select-role`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ role, clerkId, adminToken })
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.message || 'Failed to set role')
    }
    return json
  } catch (err) {
    console.error('Role selection error:', err)
    throw err
  }
}

// 1. Fetch Applications (with filters & search)
export const getApplications = async (filters = {}) => {
  try {
    const headers = await getAuthHeaders()
    const query = new URLSearchParams()
    if (filters.status && filters.status !== 'all') query.append('status', filters.status)
    if (filters.loanType && filters.loanType !== 'all') query.append('loanType', filters.loanType)
    if (filters.search) query.append('q', filters.search)

    const res = await fetch(`${API_BASE_URL}/applications?${query.toString()}`, {
      headers
    })

    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.data) && json.data.length > 0) {
        return json.data
      }
    }
  } catch (err) {
    console.warn('Live API /applications unavailable, using local cache:', err.message)
  }

  // Fallback to local storage
  return getLocalApplications(filters)
}

// 2. Fetch Single Application by ID
export const getApplicationById = async (id) => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/applications/${id}`, { headers })
    if (res.ok) {
      const json = await res.json()
      return json.application || json.data
    }
  } catch (err) {
    console.warn(`Live API /applications/${id} unavailable, using local cache:`, err.message)
  }

  const apps = getStoredApps()
  return apps.find((a) => a._id === id) || null
}

// 3. Save Application as Draft (Multi-Step & Resume Support)
export const saveDraftApplication = async (payload) => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/applications/draft`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        applicationId: payload._id,
        currentStep: payload.currentStep,
        personalDetails: payload.personalDetails,
        loanDetails: payload.loanDetails,
        incomeDetails: payload.incomeDetails,
        documents: payload.documents
      })
    })

    if (res.ok) {
      const json = await res.json()
      if (json.application) {
        // Also update local cache
        saveLocalApp(json.application)
        return json.application
      }
    }
  } catch (err) {
    console.warn('Live API /applications/draft unavailable, using local cache:', err.message)
  }

  return saveLocalDraft(payload)
}

// 4. Submit Application
export const submitNewApplication = async (payload) => {
  try {
    const headers = await getAuthHeaders()
    // First ensure draft is saved
    let targetId = payload._id
    if (!targetId || targetId.startsWith('app_draft')) {
      const draft = await saveDraftApplication(payload)
      targetId = draft._id
    }

    const res = await fetch(`${API_BASE_URL}/applications/${targetId}/submit`, {
      method: 'POST',
      headers
    })

    if (res.ok) {
      const json = await res.json()
      if (json.application) {
        saveLocalApp(json.application)
        return json.application
      }
    }
  } catch (err) {
    console.warn('Live API /applications/submit unavailable, using local cache:', err.message)
  }

  return submitLocalApplication(payload)
}

// 5. Run Rule-Based Deterministic Eligibility Check
export const runEligibilityCheck = async (id, officerName = 'Officer Jane Doe') => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/reviews/${id}/eligibility`, {
      method: 'POST',
      headers
    })

    if (res.ok) {
      const json = await res.json()
      if (json.eligibilityCheck) {
        const app = await getApplicationById(id)
        if (app) {
          app.eligibilityCheck = json.eligibilityCheck
          app.status = json.status || 'under_review'
          saveLocalApp(app)
          return app
        }
      }
    }
  } catch (err) {
    console.warn('Live API /reviews/eligibility unavailable, using local engine:', err.message)
  }

  return runLocalEligibilityCheck(id, officerName)
}

// 6. Submit Loan Officer Review
export const submitOfficerReview = async (id, { recommendation, remarks, infoRequested }, officerName = 'Officer Jane Doe') => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/reviews/${id}/officer-review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ recommendation, remarks, infoRequested })
    })

    if (res.ok) {
      const json = await res.json()
      if (json.application) {
        saveLocalApp(json.application)
        return json.application
      }
    }
  } catch (err) {
    console.warn('Live API /reviews/officer-review unavailable, using local state:', err.message)
  }

  return submitLocalOfficerReview(id, { recommendation, remarks, infoRequested }, officerName)
}

// 7. Submit Admin Final Decision
export const submitAdminDecision = async (id, { decision, remarks }, adminName = 'Admin Chief Credit Officer') => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/reviews/${id}/admin-decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ decision, remarks })
    })

    if (res.ok) {
      const json = await res.json()
      if (json.application) {
        saveLocalApp(json.application)
        return {
          app: json.application,
          repaymentSchedule: json.repaymentSchedule
        }
      }
    }
  } catch (err) {
    console.warn('Live API /reviews/admin-decision unavailable, using local state:', err.message)
  }

  return submitLocalAdminDecision(id, { decision, remarks }, adminName)
}

// 8. Fetch Repayment Schedule by Application ID
export const getRepaymentSchedule = async (applicationId) => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/repayments/application/${applicationId}`, { headers })
    if (res.ok) {
      const json = await res.json()
      if (json.schedule) return json.schedule
    }
  } catch (err) {
    console.warn('Live API /repayments/application unavailable, using local cache:', err.message)
  }

  const schedules = getStoredSchedules()
  return schedules.find((s) => s.applicationId === applicationId) || null
}

// 9. Update Installment Status (Admin: Mark Paid / Overdue)
export const updateInstallmentStatus = async (scheduleId, installmentNumber, { status, paymentReference, remarks }) => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/repayments/${scheduleId}/installments/${installmentNumber}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, paymentReference, remarks })
    })

    if (res.ok) {
      const json = await res.json()
      if (json.schedule) return json.schedule
    }
  } catch (err) {
    console.warn('Live API /repayments/installments unavailable, using local cache:', err.message)
  }

  return updateLocalInstallmentStatus(scheduleId, installmentNumber, { status, paymentReference, remarks })
}

// 10. Applicant Respond to More Info Needed
export const respondToMoreInfo = async (id, { responseText, newDocumentName }) => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/applications/${id}/respond-info`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        responseText,
        additionalDocuments: newDocumentName
          ? [
              {
                documentType: 'income_proof',
                fileName: newDocumentName,
                fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800'
              }
            ]
          : []
      })
    })

    if (res.ok) {
      const json = await res.json()
      if (json.application) {
        saveLocalApp(json.application)
        return json.application
      }
    }
  } catch (err) {
    console.warn('Live API /applications/respond-info unavailable, using local state:', err.message)
  }

  return respondLocalMoreInfo(id, { responseText, newDocumentName })
}

// -------------------------------------------------------------
// LOCAL STATE FALLBACKS (Ensure 100% resilient UI demo & tests)
// -------------------------------------------------------------

const INITIAL_APPLICATIONS = []

const INITIAL_SCHEDULES = []

const getStoredApps = () => {
  try {
    const raw = localStorage.getItem('correm_lms_applications')
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  return []
}

const saveStoredApps = (apps) => {
  localStorage.setItem('correm_lms_applications', JSON.stringify(apps))
}

const saveLocalApp = (app) => {
  const apps = getStoredApps()
  const idx = apps.findIndex((a) => a._id === app._id)
  if (idx > -1) {
    apps[idx] = app
  } else {
    apps.unshift(app)
  }
  saveStoredApps(apps)
}

const getStoredSchedules = () => {
  try {
    const raw = localStorage.getItem('correm_lms_schedules')
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  return []
}

// Clear any dummy cache in browser storage
export const clearDummyData = () => {
  try {
    localStorage.removeItem('correm_lms_applications')
    localStorage.removeItem('correm_lms_schedules')
    localStorage.removeItem('correm_lms_draft')
    console.log('Dummy applications and schedules purged from storage.')
  } catch (e) {
    console.error('Storage clear error:', e)
  }
}

// Auto-clean any legacy dummy data
if (typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('correm_lms_applications')
    if (cached && cached.includes('app_65a101')) {
      clearDummyData()
    }
  } catch (e) {}
}

const saveStoredSchedules = (schedules) => {
  localStorage.setItem('correm_lms_schedules', JSON.stringify(schedules))
}

const getLocalApplications = (filters = {}) => {
  const apps = getStoredApps()
  let filtered = [...apps]

  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter((a) => a.status === filters.status)
  }

  if (filters.loanType && filters.loanType !== 'all') {
    filtered = filtered.filter((a) => a.loanDetails?.loanType === filters.loanType)
  }

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (a) =>
        a.applicationNumber?.toLowerCase().includes(q) ||
        a.personalDetails?.fullName?.toLowerCase().includes(q) ||
        a.personalDetails?.panNumber?.toLowerCase().includes(q)
    )
  }

  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

const saveLocalDraft = (payload) => {
  const apps = getStoredApps()
  let app

  const P = Number(payload.loanDetails?.amount) || 0
  const rate = Number(payload.loanDetails?.interestRate) || 12.0
  const tenure = Number(payload.loanDetails?.tenureMonths) || 12
  const r = rate / 12 / 100
  const emi = P > 0 && tenure > 0 && r > 0 ? Math.round((P * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1)) : 0

  if (payload._id) {
    const index = apps.findIndex((a) => a._id === payload._id)
    if (index > -1) {
      app = {
        ...apps[index],
        ...payload,
        loanDetails: {
          ...payload.loanDetails,
          monthlyEmiPreview: emi
        },
        status: 'draft',
        isDraft: true,
        updatedAt: new Date().toISOString()
      }
      apps[index] = app
    }
  }

  if (!app) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    app = {
      _id: `app_draft_${Date.now()}`,
      applicationNumber: `LMS-DRAFT-${randomSuffix}`,
      applicantId: {
        _id: 'usr_current',
        name: payload.personalDetails?.fullName || 'Current Applicant',
        email: 'applicant@example.com',
        phone: payload.personalDetails?.phone || ''
      },
      status: 'draft',
      isDraft: true,
      currentStep: payload.currentStep || 1,
      personalDetails: payload.personalDetails || {},
      loanDetails: {
        ...payload.loanDetails,
        monthlyEmiPreview: emi
      },
      incomeDetails: payload.incomeDetails || {},
      documents: payload.documents || [],
      eligibilityCheck: null,
      officerReview: null,
      adminDecision: null,
      createdAt: new Date().toISOString()
    }
    apps.unshift(app)
  }

  saveStoredApps(apps)
  return app
}

const submitLocalApplication = (payload) => {
  const apps = getStoredApps()
  let app

  const P = Number(payload.loanDetails?.amount) || 0
  const rate = Number(payload.loanDetails?.interestRate) || 12.0
  const tenure = Number(payload.loanDetails?.tenureMonths) || 12
  const r = rate / 12 / 100
  const emi = P > 0 && tenure > 0 && r > 0 ? Math.round((P * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1)) : 0

  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  const appNumber = payload.applicationNumber && !payload.applicationNumber.includes('DRAFT')
    ? payload.applicationNumber
    : `LMS-2026-${randomSuffix}`

  if (payload._id) {
    const index = apps.findIndex((a) => a._id === payload._id)
    if (index > -1) {
      app = {
        ...apps[index],
        ...payload,
        applicationNumber: appNumber,
        loanDetails: {
          ...payload.loanDetails,
          monthlyEmiPreview: emi
        },
        status: 'submitted',
        isDraft: false,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      apps[index] = app
    }
  }

  if (!app) {
    app = {
      _id: `app_${Date.now()}`,
      applicationNumber: appNumber,
      applicantId: {
        _id: 'usr_current',
        name: payload.personalDetails?.fullName || 'Current Applicant',
        email: 'applicant@example.com',
        phone: payload.personalDetails?.phone || ''
      },
      status: 'submitted',
      isDraft: false,
      currentStep: 4,
      personalDetails: payload.personalDetails || {},
      loanDetails: {
        ...payload.loanDetails,
        monthlyEmiPreview: emi
      },
      incomeDetails: payload.incomeDetails || {},
      documents: payload.documents || [],
      eligibilityCheck: null,
      officerReview: null,
      adminDecision: null,
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString()
    }
    apps.unshift(app)
  }

  saveStoredApps(apps)
  return app
}

const runLocalEligibilityCheck = (id, officerName) => {
  const apps = getStoredApps()
  const index = apps.findIndex((a) => a._id === id)
  if (index === -1) throw new Error('Application not found')

  const app = apps[index]
  const income = Number(app.incomeDetails?.monthlyIncome) || 0
  const existingEmi = Number(app.incomeDetails?.existingMonthlyEmi) || 0
  const proposedEmi = Number(app.loanDetails?.monthlyEmiPreview) || 0
  const totalEmi = existingEmi + proposedEmi
  const dti = income > 0 ? (totalEmi / income) * 100 : 100

  let age = 30
  if (app.personalDetails?.dateOfBirth) {
    const diff = Date.now() - new Date(app.personalDetails.dateOfBirth).getTime()
    age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  }

  const ageRulePassed = age >= 21 && age <= 65
  const minIncomeThresholds = { personal: 25000, vehicle: 30000, home: 40000, business: 50000 }
  const minRequired = minIncomeThresholds[app.loanDetails?.loanType] || 25000
  const incomeRulePassed = income >= minRequired
  const dtiRulePassed = dti <= 50
  const docTypes = (app.documents || []).map((d) => d.documentType)
  const docsRulePassed = docTypes.includes('id_proof') && docTypes.includes('income_proof')

  const ruleResults = [
    {
      rule: 'Age Criteria',
      passed: ageRulePassed,
      message: ageRulePassed
        ? `Applicant age (${age} yrs) complies with acceptable age boundaries (21-65 yrs).`
        : `Applicant age (${age || 'N/A'} yrs) is outside permissible range (21-65 yrs).`,
      actualValue: age,
      threshold: '21 - 65 yrs'
    },
    {
      rule: 'Minimum Monthly Income',
      passed: incomeRulePassed,
      message: incomeRulePassed
        ? `Reported income (₹${income.toLocaleString('en-IN')}) meets minimum threshold (₹${minRequired.toLocaleString('en-IN')}) for ${app.loanDetails?.loanType} loan.`
        : `Reported income (₹${income.toLocaleString('en-IN')}) is below required ₹${minRequired.toLocaleString('en-IN')} threshold.`,
      actualValue: income,
      threshold: `₹${minRequired.toLocaleString('en-IN')}`
    },
    {
      rule: 'Debt-to-Income (DTI) Tolerance',
      passed: dtiRulePassed,
      message: dtiRulePassed
        ? `DTI ratio (${dti.toFixed(1)}%) is within safe risk limits (<= 50%).`
        : `DTI ratio (${dti.toFixed(1)}%) exceeds maximum acceptable risk threshold (<= 50%).`,
      actualValue: `${dti.toFixed(1)}%`,
      threshold: '<= 50%'
    },
    {
      rule: 'Mandatory Document Verification',
      passed: docsRulePassed,
      message: docsRulePassed
        ? 'Both identity proof and income proof are present and verified.'
        : `Missing mandatory documents: ${!docTypes.includes('id_proof') ? '[ID Proof] ' : ''}${!docTypes.includes('income_proof') ? '[Income Proof]' : ''}`.trim(),
      actualValue: docTypes,
      threshold: ['id_proof', 'income_proof']
    }
  ]

  const isEligible = ruleResults.every((r) => r.passed)
  const summary = isEligible
    ? 'Applicant passes all deterministic credit policy checks.'
    : `Application flagged on ${ruleResults.filter((r) => !r.passed).map((r) => r.rule).join(', ')}.`

  app.eligibilityCheck = {
    isEligible,
    debtToIncomeRatio: Math.round(dti * 10) / 10,
    calculatedAge: age,
    summary,
    ruleResults,
    checkedAt: new Date().toISOString(),
    checkedBy: officerName
  }

  if (app.status === 'submitted') {
    app.status = 'under_review'
  }

  apps[index] = app
  saveStoredApps(apps)
  return app
}

const submitLocalOfficerReview = (id, { recommendation, remarks, infoRequested }, officerName) => {
  const apps = getStoredApps()
  const index = apps.findIndex((a) => a._id === id)
  if (index === -1) throw new Error('Application not found')

  const app = apps[index]
  app.officerReview = {
    recommendation,
    remarks: remarks || '',
    infoRequested: infoRequested || '',
    reviewedAt: new Date().toISOString(),
    reviewedBy: officerName
  }

  app.status = recommendation
  apps[index] = app
  saveStoredApps(apps)
  return app
}

const submitLocalAdminDecision = (id, { decision, remarks }, adminName) => {
  const apps = getStoredApps()
  const index = apps.findIndex((a) => a._id === id)
  if (index === -1) throw new Error('Application not found')

  const app = apps[index]
  app.adminDecision = {
    decision,
    remarks: remarks || '',
    decidedAt: new Date().toISOString(),
    decidedBy: adminName
  }

  app.status = decision
  apps[index] = app
  saveStoredApps(apps)

  let repaymentSchedule = null

  if (decision === 'approved') {
    const P = Number(app.loanDetails?.amount) || 500000
    const annualRate = Number(app.loanDetails?.interestRate) || 12.0
    const tenure = Number(app.loanDetails?.tenureMonths) || 24
    const r = annualRate / 12 / 100
    const emi = Math.round((P * r * Math.pow(1 + r, tenure)) / (Math.pow(1 + r, tenure) - 1))

    let balance = P
    const installments = []
    const now = new Date()

    for (let i = 1; i <= tenure; i++) {
      const dueDate = new Date(now.getFullYear(), now.getMonth() + i, 15).toISOString()
      const interestComponent = Math.round(balance * r)
      let principalComponent = emi - interestComponent

      if (i === tenure || principalComponent > balance) {
        principalComponent = balance
      }
      balance = Math.max(0, balance - principalComponent)

      installments.push({
        installmentNumber: i,
        dueDate,
        emiAmount: principalComponent + interestComponent,
        principalComponent,
        interestComponent,
        remainingPrincipal: balance,
        status: 'pending',
        paidDate: null,
        paymentReference: ''
      })
    }

    const totalInterest = installments.reduce((acc, curr) => acc + curr.interestComponent, 0)
    const totalAmountPayable = P + totalInterest

    const schedules = getStoredSchedules()
    const existingIndex = schedules.findIndex((s) => s.applicationId === id)

    repaymentSchedule = {
      _id: `sch_${Date.now()}`,
      applicationId: app._id,
      applicantId: app.applicantId?._id || 'usr_unknown',
      loanType: app.loanDetails?.loanType || 'personal',
      totalPrincipal: P,
      annualInterestRate: annualRate,
      tenureMonths: tenure,
      monthlyEmi: emi,
      totalInterest,
      totalAmountPayable,
      startDate: new Date().toISOString(),
      status: 'active',
      installments
    }

    if (existingIndex > -1) {
      schedules[existingIndex] = repaymentSchedule
    } else {
      schedules.push(repaymentSchedule)
    }
    saveStoredSchedules(schedules)
  }

  return { app, repaymentSchedule }
}

const updateLocalInstallmentStatus = (scheduleId, installmentNumber, { status, paymentReference, remarks }) => {
  const schedules = getStoredSchedules()
  const scheduleIndex = schedules.findIndex((s) => s._id === scheduleId)
  if (scheduleIndex === -1) throw new Error('Repayment schedule not found')

  const schedule = schedules[scheduleIndex]
  const installment = schedule.installments.find((i) => i.installmentNumber === Number(installmentNumber))
  if (!installment) throw new Error(`Installment #${installmentNumber} not found`)

  installment.status = status
  installment.paidDate = status === 'paid' ? new Date().toISOString() : null
  if (paymentReference) installment.paymentReference = paymentReference
  if (remarks) installment.remarks = remarks

  const allPaid = schedule.installments.every((i) => i.status === 'paid')
  if (allPaid) {
    schedule.status = 'closed'
  } else if (schedule.installments.some((i) => i.status === 'overdue')) {
    schedule.status = 'active'
  }

  schedules[scheduleIndex] = schedule
  saveStoredSchedules(schedules)
  return schedule
}

const respondLocalMoreInfo = (id, { responseText, newDocumentName }) => {
  const apps = getStoredApps()
  const index = apps.findIndex((a) => a._id === id)
  if (index === -1) throw new Error('Application not found')

  const app = apps[index]
  app.applicantResponse = {
    responseText,
    respondedAt: new Date().toISOString()
  }

  if (newDocumentName) {
    app.documents.push({
      _id: `doc_${Date.now()}`,
      documentType: 'income_proof',
      fileName: newDocumentName,
      fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
      fileSize: 1500000,
      uploadedAt: new Date().toISOString()
    })
  }

  app.status = 'under_review'
  apps[index] = app
  saveStoredApps(apps)
  return app
}

export default {
  getAuthHeaders,
  syncClerkUser,
  getApplications,
  getApplicationById,
  saveDraftApplication,
  submitNewApplication,
  runEligibilityCheck,
  submitOfficerReview,
  submitAdminDecision,
  getRepaymentSchedule,
  updateInstallmentStatus,
  respondToMoreInfo
}
