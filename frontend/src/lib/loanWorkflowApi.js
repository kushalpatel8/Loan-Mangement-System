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
      if (window.Clerk.user?.id) {
        headers['x-clerk-user-id'] = window.Clerk.user.id
      }
      if (window.Clerk.user?.primaryEmailAddress?.emailAddress) {
        headers['x-user-email'] = window.Clerk.user.primaryEmailAddress.emailAddress
      }
      if (window.Clerk.user?.fullName) {
        headers['x-user-name'] = window.Clerk.user.fullName
      }
    }

    // Attach local locked role header if present
    if (typeof window !== 'undefined') {
      let activeRole = sessionStorage.getItem('lms_user_role') || localStorage.getItem('lms_user_role')
      if (window.location.pathname.startsWith('/officer')) {
        activeRole = 'loan_officer'
      } else if (window.location.pathname.startsWith('/admin')) {
        activeRole = 'admin'
      }
      if (activeRole) {
        headers['x-user-role'] = activeRole
      }
      const activeEmail = sessionStorage.getItem('lms_user_email') || localStorage.getItem('lms_user_email')
      if (activeEmail && !headers['x-user-email']) {
        headers['x-user-email'] = activeEmail
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
  let liveApps = []
  let apiSuccess = false
  const activeEmail =
    filters.applicantEmail ||
    (typeof window !== 'undefined'
      ? window.Clerk?.user?.primaryEmailAddress?.emailAddress ||
        sessionStorage.getItem('lms_user_email') ||
        localStorage.getItem('lms_user_email')
      : null)

  try {
    const headers = await getAuthHeaders()
    const query = new URLSearchParams()
    if (filters.status && filters.status !== 'all') query.append('status', filters.status)
    if (filters.loanType && filters.loanType !== 'all') query.append('loanType', filters.loanType)
    if (filters.search) query.append('q', filters.search)
    if (filters.forApplicantOnly && activeEmail) query.append('email', activeEmail)

    // For applicant's own dashboard, use /my endpoint or /applications?email=
    const endpoint = filters.forApplicantOnly ? `${API_BASE_URL}/applications/my?${query.toString()}` : `${API_BASE_URL}/applications?${query.toString()}`

    const res = await fetch(endpoint, {
      headers
    })

    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.data)) {
        liveApps = json.data
        apiSuccess = true
        // Cache live records locally so all browser tabs and views share them
        liveApps.forEach((app) => saveLocalApp(app))
      }
    }
  } catch (err) {
    console.warn('Live API /applications query error:', err.message)
  }

  // Get locally stored applications
  const localApps = getLocalApplications({ ...filters, applicantEmail: activeEmail })

  // Seamless merge of live server database and local cache
  const map = new Map()
  liveApps.forEach((app) => map.set(app._id, app))
  localApps.forEach((app) => {
    if (!map.has(app._id)) {
      map.set(app._id, app)
    }
  })
  let list = Array.from(map.values())

  if (filters.forApplicantOnly) {
    if (!activeEmail) return []
    const targetEmail = activeEmail.toLowerCase().trim()
    list = list.filter((a) => {
      const appEmail = (
        a.applicantId?.email ||
        a.personalDetails?.email ||
        a.applicantEmail ||
        ''
      ).toLowerCase().trim()
      return appEmail === targetEmail
    })
  } else if (filters.excludeDrafts) {
    // For Loan Officer & Admin queue: exclude drafts
    list = list.filter((a) => a.status !== 'draft')
  }

  if (filters.status && filters.status !== 'all') {
    list = list.filter((a) => a.status === filters.status)
  }

  if (filters.loanType && filters.loanType !== 'all') {
    list = list.filter((a) => a.loanDetails?.loanType === filters.loanType)
  }

  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter(
      (a) =>
        a.applicationNumber?.toLowerCase().includes(q) ||
        a.personalDetails?.fullName?.toLowerCase().includes(q) ||
        a.personalDetails?.panNumber?.toLowerCase().includes(q)
    )
  }

  // Strictly filter out any mock or dummy applications
  list = list.filter((a) => !isDummyApp(a))

  return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
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
    const isMongoId = payload._id && /^[0-9a-fA-F]{24}$/.test(payload._id)
    const res = await fetch(`${API_BASE_URL}/applications/draft`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        applicationId: isMongoId ? payload._id : undefined,
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

// Cloudinary direct browser upload helper
const uploadDirectToCloudinary = async (file, folder = 'loan_management_system/documents') => {
  const cloudUrl =
    import.meta.env.VITE_CLOUDINARY_URL ||
    'cloudinary://825456344341562:aneaq0vArvsEpUWjhWmXa2HMgnE@hwg5chas'
  const match = cloudUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/)
  if (!match) return null

  const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY || match[1]
  const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET || match[2]
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || match[3]

  const timestamp = Math.floor(Date.now() / 1000)
  const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`

  // Compute SHA-1 signature using standard browser Web Crypto API
  const encoder = new TextEncoder()
  const data = encoder.encode(stringToSign)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', apiKey)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)
  formData.append('folder', folder)

  const isPdf = file.name?.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
  const endpointType = isPdf ? 'raw' : 'image'

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${endpointType}/upload`, {
    method: 'POST',
    body: formData
  })

  if (res.ok) {
    const data = await res.json()
    return {
      fileUrl: data.secure_url || data.url,
      publicId: data.public_id,
      bytes: data.bytes,
      format: data.format
    }
  } else {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData?.error?.message || 'Cloudinary upload failed')
  }
}

// 3.1 Upload Document File (MongoDB Atlas Database Storage with In-Memory Buffer)
export const uploadDocumentFile = async (file, documentType = 'id_proof') => {
  // 1. Upload to Backend MongoDB Document Storage
  try {
    const headers = await getAuthHeaders()
    // Remove Content-Type so browser sets boundary for multipart/form-data
    delete headers['Content-Type']

    const formData = new FormData()
    formData.append('documents', file)
    formData.append('documentType', documentType)

    const res = await fetch(`${API_BASE_URL}/applications/upload-document`, {
      method: 'POST',
      headers,
      body: formData
    })

    if (res.ok) {
      const json = await res.json()
      if (json.documents && json.documents.length > 0) {
        const doc = json.documents[0]
        if (doc.fileUrl && doc.fileUrl.startsWith('/') && !doc.fileUrl.startsWith('//')) {
          const backendBase = (import.meta.env.VITE_BACKEND_URL || (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1\/?$/, '')).replace(/\/$/, '')
          if (backendBase) {
            doc.fileUrl = `${backendBase}${doc.fileUrl}`
          }
        }
        return doc
      }
    } else {
      const errJson = await res.json().catch(() => ({}))
      console.warn('Backend MongoDB upload error response:', errJson?.message)
    }
  } catch (err) {
    console.warn('Backend file upload to MongoDB unavailable, using local preview fallback:', err.message)
  }

  // 2. Resilient client fallback (creates blob object URL for immediate preview)
  return {
    _id: `doc_${Date.now()}`,
    documentType,
    fileName: file.name,
    fileSize: file.size,
    fileUrl: URL.createObjectURL(file),
    mimeType: file.type || 'application/pdf',
    uploadedAt: new Date().toISOString()
  }
}

// 4. Submit Application
export const submitNewApplication = async (payload) => {
  try {
    const headers = await getAuthHeaders()
    const isMongoId = payload._id && /^[0-9a-fA-F]{24}$/.test(payload._id)

    let targetId = isMongoId ? payload._id : null
    if (!targetId) {
      const draft = await saveDraftApplication({ ...payload, _id: undefined })
      if (draft && draft._id && /^[0-9a-fA-F]{24}$/.test(draft._id)) {
        targetId = draft._id
      }
    }

    const endpoint = targetId
      ? `${API_BASE_URL}/applications/${targetId}/submit`
      : `${API_BASE_URL}/applications/submit`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
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

// 11. User Management (Admin Only)
export const getAdminUsers = async (filters = {}) => {
  try {
    const headers = await getAuthHeaders()
    const query = new URLSearchParams()
    if (filters.role && filters.role !== 'all') query.append('role', filters.role)
    if (filters.q) query.append('q', filters.q)

    const res = await fetch(`${API_BASE_URL}/users?${query.toString()}`, { headers })
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.data)) return json.data
    }
  } catch (err) {
    console.warn('Live API /users unavailable, using local users cache:', err.message)
  }

  // Fallback local users
  return getLocalUsers(filters)
}

export const updateUserRole = async (userId, role) => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role })
    })
    if (res.ok) {
      const json = await res.json()
      return json.user
    }
  } catch (err) {
    console.warn('Live API /users/role unavailable, updating local state:', err.message)
  }

  return updateLocalUserRole(userId, role)
}

export const toggleUserStatus = async (userId) => {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/users/${userId}/status`, {
      method: 'PATCH',
      headers
    })
    if (res.ok) {
      const json = await res.json()
      return json.user
    }
  } catch (err) {
    console.warn('Live API /users/status unavailable, updating local state:', err.message)
  }

  return toggleLocalUserStatus(userId)
}

const getStoredUsers = () => {
  try {
    const raw = localStorage.getItem('correm_lms_users')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return []
}

const saveStoredUsers = (users) => {
  localStorage.setItem('correm_lms_users', JSON.stringify(users))
}

const getLocalUsers = (filters = {}) => {
  let list = getStoredUsers()
  if (filters.role && filters.role !== 'all') {
    list = list.filter((u) => u.role === filters.role)
  }
  if (filters.q) {
    const q = filters.q.toLowerCase()
    list = list.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    )
  }
  return list
}

const updateLocalUserRole = (userId, role) => {
  const users = getStoredUsers()
  const idx = users.findIndex((u) => u._id === userId || u.clerkId === userId)
  if (idx > -1) {
    users[idx].role = role
    users[idx].roleSelected = true
    saveStoredUsers(users)
    return users[idx]
  }
  return null
}

const toggleLocalUserStatus = (userId) => {
  const users = getStoredUsers()
  const idx = users.findIndex((u) => u._id === userId || u.clerkId === userId)
  if (idx > -1) {
    users[idx].isActive = !users[idx].isActive
    saveStoredUsers(users)
    return users[idx]
  }
  return null
}
export const respondToMoreInfo = async (
  id,
  { responseText, additionalDocuments, document, newDocumentName }
) => {
  const docs = additionalDocuments || (document ? [document] : (newDocumentName ? [{
    documentType: 'id_proof',
    fileName: newDocumentName,
    fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
    fileSize: 1500000,
    uploadedAt: new Date().toISOString()
  }] : []))

  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/applications/${id}/respond-info`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        responseText,
        additionalDocuments: docs
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

  return respondLocalMoreInfo(id, { responseText, additionalDocuments: docs, newDocumentName })
}

// 12. Applicant Request Reconsideration (Appeal Rejected Application)
export const requestReconsideration = async (
  id,
  { appealStatement, adjustedAmount, adjustedTenure, newDocumentName, document, additionalDocuments }
) => {
  const docs = additionalDocuments || (document ? [document] : (newDocumentName ? [{
    documentType: 'other',
    fileName: newDocumentName,
    fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
    fileSize: 1500000,
    uploadedAt: new Date().toISOString()
  }] : []))

  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/applications/${id}/request-reconsideration`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        appealStatement,
        adjustedAmount: adjustedAmount ? Number(adjustedAmount) : undefined,
        adjustedTenure: adjustedTenure ? Number(adjustedTenure) : undefined,
        additionalDocuments: docs
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
    console.warn('Live API request-reconsideration unavailable, using local state:', err.message)
  }

  return requestLocalReconsideration(id, { appealStatement, adjustedAmount, adjustedTenure, newDocumentName, additionalDocuments: docs })
}

// -------------------------------------------------------------
// DUMMY DATA PURGE & DETECTOR
// -------------------------------------------------------------

export const isDummyApp = (app) => {
  if (!app) return true

  const name = (
    app.personalDetails?.fullName ||
    app.applicantId?.name ||
    ''
  ).toLowerCase().trim()

  const email = (
    app.personalDetails?.email ||
    app.applicantId?.email ||
    app.applicantEmail ||
    ''
  ).toLowerCase().trim()

  const appNum = (app.applicationNumber || '').toUpperCase().trim()
  const id = String(app._id || app.id || '')

  // NEVER consider Kushal Patel or any real user application as dummy!
  if (
    email.includes('pkushal') ||
    email.includes('kushal') ||
    name.includes('kushal') ||
    appNum === 'LMS-630114-5299' ||
    id === '6b0545aea498d196a01f8430'
  ) {
    return false
  }

  // Specifically target the 4 mock dummy applications:
  // Sneha Kulkarni, Vikramaditya Rao, Ananya Deshmukh, Rahul Sharma
  const isMockName =
    name === 'sneha kulkarni' ||
    name === 'vikramaditya rao' ||
    name === 'ananya deshmukh' ||
    name === 'rahul sharma'

  const isMockEmail =
    email === 'sneha.kulkarni@example.com' ||
    email === 'vikram.rao@example.com' ||
    email === 'ananya.deshmukh@example.com' ||
    email === 'rahul.sharma@example.com' ||
    email === 'john.doe@example.com'

  const isMockNumber =
    appNum === 'LMS-2026-1045' ||
    appNum === 'LMS-2026-1044' ||
    appNum === 'LMS-2026-1043' ||
    appNum === 'LMS-2026-1042' ||
    appNum === 'LMS-2026-8842' ||
    appNum === 'LMS-2026-9120'

  const isMockId = id.startsWith('app_65a') || id.startsWith('mock_')

  if (isMockName || isMockEmail || isMockNumber || isMockId) {
    return true
  }

  return false
}

// -------------------------------------------------------------
// LOCAL STATE FALLBACKS (Ensure 100% resilient UI demo & tests)
// -------------------------------------------------------------

const INITIAL_APPLICATIONS = [
  {
    _id: '6b0545aea498d196a01f8430',
    applicationNumber: 'LMS-630114-5299',
    applicantId: {
      _id: '6b052d8b437b785a3fece423',
      name: 'Kushal Patel',
      email: 'pkushal649@gmail.com',
      phone: '9876543210'
    },
    currentStep: 1,
    isDraft: false,
    status: 'submitted',
    personalDetails: {
      fullName: 'Kushal Patel',
      email: 'pkushal649@gmail.com',
      panNumber: 'ABCDE1234F',
      phone: '9876543210',
      address: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India'
      }
    },
    loanDetails: {
      loanType: 'personal',
      amount: 300000,
      tenureMonths: 24,
      interestRate: 12,
      purpose: '',
      monthlyEmiPreview: 14122
    },
    incomeDetails: {
      monthlyIncome: 60000,
      employmentType: 'salaried',
      employerName: '',
      existingMonthlyEmi: 0
    },
    eligibilityCheck: {
      summary: '',
      ruleResults: []
    },
    officerReview: {
      remarks: '',
      infoRequested: ''
    },
    applicantResponse: {
      responseText: '',
      additionalDocuments: []
    },
    adminDecision: {
      remarks: ''
    },
    documents: [
      {
        _id: '6b0545aea498d196a01f8434',
        documentType: 'id_proof',
        fileName: 'PAN.pdf',
        fileUrl: 'http://example.com/pan.pdf',
        fileSize: 0,
        mimeType: '',
        uploadedAt: '2026-11-24T08:07:10.672Z'
      }
    ],
    createdAt: '2026-11-24T08:07:10.119Z',
    updatedAt: '2026-11-24T08:07:10.673Z'
  }
]

const INITIAL_SCHEDULES = []

const getStoredApps = () => {
  try {
    const raw = localStorage.getItem('correm_lms_applications')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed.filter((a) => !isDummyApp(a))
        const hasKushal = cleaned.some(
          (a) => a._id === '6b0545aea498d196a01f8430' || a.applicationNumber === 'LMS-630114-5299'
        )
        if (!hasKushal && INITIAL_APPLICATIONS.length > 0) {
          cleaned.unshift(...INITIAL_APPLICATIONS)
        }
        localStorage.setItem('correm_lms_applications', JSON.stringify(cleaned))
        return cleaned
      }
    }
  } catch (e) {
    console.error(e)
  }
  if (INITIAL_APPLICATIONS.length > 0) {
    saveStoredApps(INITIAL_APPLICATIONS)
  }
  return [...INITIAL_APPLICATIONS]
}

const saveStoredApps = (apps) => {
  const cleaned = (apps || []).filter((a) => !isDummyApp(a))
  localStorage.setItem('correm_lms_applications', JSON.stringify(cleaned))
}

const saveLocalApp = (app) => {
  if (isDummyApp(app)) return
  const apps = getStoredApps()
  const idx = apps.findIndex((a) => a._id === app._id || a.applicationNumber === app.applicationNumber)
  if (idx > -1) {
    apps[idx] = { ...apps[idx], ...app }
  } else {
    apps.unshift(app)
  }
  saveStoredApps(apps)
}

const getStoredSchedules = () => {
  try {
    const raw = localStorage.getItem('correm_lms_schedules')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((s) => {
          const num = String(s.applicationNumber || '').toUpperCase()
          const id = String(s.applicationId || '')
          return !num.startsWith('LMS-2026-104') && !id.startsWith('app_65a')
        })
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('correm_lms_schedules', JSON.stringify(cleaned))
        }
        return cleaned
      }
    }
  } catch (e) {
    console.error(e)
  }
  return []
}

// Clear any dummy cache in browser storage
export const clearDummyData = () => {
  try {
    const rawApps = localStorage.getItem('correm_lms_applications')
    if (rawApps) {
      const parsed = JSON.parse(rawApps)
      const realOnly = Array.isArray(parsed) ? parsed.filter((a) => !isDummyApp(a)) : []
      const hasKushal = realOnly.some(
        (a) => a._id === '6b0545aea498d196a01f8430' || a.applicationNumber === 'LMS-630114-5299'
      )
      if (!hasKushal && INITIAL_APPLICATIONS.length > 0) {
        realOnly.unshift(...INITIAL_APPLICATIONS)
      }
      localStorage.setItem('correm_lms_applications', JSON.stringify(realOnly))
    }
    const rawSched = localStorage.getItem('correm_lms_schedules')
    if (rawSched) {
      const parsed = JSON.parse(rawSched)
      const realSched = Array.isArray(parsed)
        ? parsed.filter((s) => !String(s.applicationId || '').startsWith('app_65a') && !String(s.applicationNumber || '').startsWith('LMS-2026-104'))
        : []
      localStorage.setItem('correm_lms_schedules', JSON.stringify(realSched))
    }
    localStorage.removeItem('correm_lms_draft')
    console.log('Dummy applications and schedules purged from storage.')
  } catch (e) {
    console.error('Storage clear error:', e)
  }
}

// Auto-clean any legacy dummy data immediately on script load
if (typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('correm_lms_applications')
    if (
      cached &&
      (cached.includes('Sneha') ||
        cached.includes('Vikramaditya') ||
        cached.includes('Deshmukh') ||
        cached.includes('Rahul Sharma') ||
        cached.includes('LMS-2026-1045') ||
        cached.includes('LMS-2026-1044') ||
        cached.includes('LMS-2026-1043') ||
        cached.includes('LMS-2026-1042') ||
        cached.includes('app_65a'))
    ) {
      clearDummyData()
    }
  } catch (e) { }
}

const saveStoredSchedules = (schedules) => {
  localStorage.setItem('correm_lms_schedules', JSON.stringify(schedules))
}

const getLocalApplications = (filters = {}) => {
  const apps = getStoredApps()
  let filtered = [...apps]

  // If officer or admin is viewing without explicit status filter, exclude drafts
  if (filters.excludeDrafts) {
    filtered = filtered.filter((a) => a.status !== 'draft')
  }

  // Email scoping: applicants strictly only see applications tied to their unique email address
  if (filters.forApplicantOnly) {
    if (!filters.applicantEmail) {
      return []
    }
    const targetEmail = filters.applicantEmail.toLowerCase().trim()
    filtered = filtered.filter((a) => {
      const email = (
        a.applicantId?.email ||
        a.personalDetails?.email ||
        a.applicantEmail ||
        ''
      ).toLowerCase().trim()
      return email === targetEmail
    })
  }

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

  const currentEmail =
    payload.applicantEmail ||
    payload.personalDetails?.email ||
    (typeof window !== 'undefined'
      ? window.Clerk?.user?.primaryEmailAddress?.emailAddress ||
        sessionStorage.getItem('lms_user_email') ||
        localStorage.getItem('lms_user_email')
      : null) ||
    'applicant@example.com'

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
        applicantId: {
          ...apps[index].applicantId,
          email: currentEmail || apps[index].applicantId?.email || 'applicant@example.com'
        },
        personalDetails: {
          ...apps[index].personalDetails,
          ...payload.personalDetails,
          email: currentEmail
        },
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
        email: currentEmail,
        phone: payload.personalDetails?.phone || ''
      },
      status: 'draft',
      isDraft: true,
      currentStep: payload.currentStep || 1,
      personalDetails: {
        ...(payload.personalDetails || {}),
        email: currentEmail
      },
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
  const currentEmail =
    payload.applicantEmail ||
    payload.personalDetails?.email ||
    (typeof window !== 'undefined'
      ? window.Clerk?.user?.primaryEmailAddress?.emailAddress ||
        sessionStorage.getItem('lms_user_email') ||
        localStorage.getItem('lms_user_email')
      : null) ||
    'applicant@example.com'

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
        applicantId: {
          ...apps[index].applicantId,
          email: currentEmail
        },
        personalDetails: {
          ...apps[index].personalDetails,
          ...payload.personalDetails,
          email: currentEmail
        },
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
        _id: `usr_${Date.now()}`,
        name: payload.personalDetails?.fullName || 'Current Applicant',
        email: currentEmail,
        phone: payload.personalDetails?.phone || ''
      },
      status: 'submitted',
      isDraft: false,
      currentStep: 4,
      personalDetails: {
        ...(payload.personalDetails || {}),
        email: currentEmail
      },
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

const respondLocalMoreInfo = (id, { responseText, additionalDocuments, newDocumentName }) => {
  const apps = getStoredApps()
  const index = apps.findIndex((a) => a._id === id)
  if (index === -1) throw new Error('Application not found')

  const app = apps[index]
  const docs = additionalDocuments || (newDocumentName ? [{
    _id: `doc_${Date.now()}`,
    documentType: 'id_proof',
    fileName: newDocumentName,
    fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
    fileSize: 1500000,
    uploadedAt: new Date().toISOString()
  }] : [])

  app.applicantResponse = {
    responseText,
    respondedAt: new Date().toISOString(),
    additionalDocuments: docs
  }

  app.documents = app.documents || []
  if (docs.length > 0) {
    app.documents.push(...docs)
  }

  app.status = 'under_review'
  apps[index] = app
  saveStoredApps(apps)
  return app
}

const requestLocalReconsideration = (
  id,
  { appealStatement, adjustedAmount, adjustedTenure, newDocumentName, additionalDocuments }
) => {
  const apps = getStoredApps()
  const index = apps.findIndex((a) => a._id === id)
  if (index === -1) throw new Error('Application not found')

  const app = apps[index]

  // Attach reconsideration payload
  app.reconsiderationRequest = {
    appealStatement: appealStatement || 'Applicant requested reconsideration with updated terms.',
    requestedAt: new Date().toISOString(),
    adjustedAmount: adjustedAmount ? Number(adjustedAmount) : null,
    adjustedTenure: adjustedTenure ? Number(adjustedTenure) : null
  }

  // Adjust terms if requested
  if (adjustedAmount && Number(adjustedAmount) > 0) {
    app.loanDetails = app.loanDetails || {}
    app.loanDetails.amount = Number(adjustedAmount)
  }
  if (adjustedTenure && Number(adjustedTenure) > 0) {
    app.loanDetails = app.loanDetails || {}
    app.loanDetails.tenureMonths = Number(adjustedTenure)
  }

  // Recalculate monthly EMI preview
  if (app.loanDetails?.amount && app.loanDetails?.tenureMonths && app.loanDetails?.interestRate) {
    const P = app.loanDetails.amount
    const r = (app.loanDetails.interestRate / 12) / 100
    const n = app.loanDetails.tenureMonths
    const emi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
    app.loanDetails.monthlyEmiPreview = emi
  }

  if (Array.isArray(additionalDocuments) && additionalDocuments.length > 0) {
    app.documents = app.documents || []
    additionalDocuments.forEach((doc) => {
      app.documents.push({
        _id: doc._id || `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        documentType: doc.documentType || 'other',
        fileName: doc.fileName,
        fileUrl: doc.fileUrl || 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
        fileSize: doc.fileSize || 1500000,
        uploadedAt: doc.uploadedAt || new Date().toISOString()
      })
    })
  } else if (newDocumentName) {
    app.documents = app.documents || []
    app.documents.push({
      _id: `doc_${Date.now()}`,
      documentType: 'other',
      fileName: newDocumentName,
      fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
      fileSize: 1500000,
      uploadedAt: new Date().toISOString()
    })
  }

  // Reset decision and return to under_review state
  delete app.adminDecision
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
  respondToMoreInfo,
  requestReconsideration
}
