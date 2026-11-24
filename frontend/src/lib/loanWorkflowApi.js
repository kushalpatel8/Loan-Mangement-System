// API & State Service for Review Workflow (Officer -> Admin -> Repayment)

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

// Initial realistic applications to seed the workflow out-of-the-box
const INITIAL_APPLICATIONS = [
  {
    _id: 'app_65a101',
    applicationNumber: 'LMS-2026-8842',
    applicantId: {
      _id: 'usr_101',
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.com',
      phone: '+91 98765 43210'
    },
    status: 'submitted',
    currentStep: 4,
    personalDetails: {
      fullName: 'Rohan Sharma',
      dateOfBirth: '1995-04-12',
      panNumber: 'ABCPS1234F',
      phone: '+91 98765 43210',
      address: {
        street: '42, Park Street, HSR Layout',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560102',
        country: 'India'
      }
    },
    loanDetails: {
      loanType: 'personal',
      amount: 450000,
      tenureMonths: 24,
      interestRate: 12.0,
      monthlyEmiPreview: 21183,
      purpose: 'Home renovation and electronic appliances'
    },
    incomeDetails: {
      monthlyIncome: 65000,
      employmentType: 'salaried',
      employerName: 'Infosys Ltd',
      existingMonthlyEmi: 5000
    },
    documents: [
      {
        _id: 'doc_1',
        documentType: 'id_proof',
        fileName: 'PAN_Card_Rohan.pdf',
        fileUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800',
        fileSize: 1048576,
        uploadedAt: '2026-11-20T10:30:00Z'
      },
      {
        _id: 'doc_2',
        documentType: 'income_proof',
        fileName: 'Salary_Slip_Oct2026.pdf',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
        fileSize: 2097152,
        uploadedAt: '2026-11-20T10:35:00Z'
      }
    ],
    eligibilityCheck: null,
    officerReview: null,
    adminDecision: null,
    createdAt: '2026-11-20T10:35:00Z'
  },
  {
    _id: 'app_65a102',
    applicationNumber: 'LMS-2026-9120',
    applicantId: {
      _id: 'usr_102',
      name: 'Priya Mukherjee',
      email: 'priya.m@example.com',
      phone: '+91 91234 56789'
    },
    status: 'under_review',
    currentStep: 4,
    personalDetails: {
      fullName: 'Priya Mukherjee',
      dateOfBirth: '1992-08-25',
      panNumber: 'BCEPM9876K',
      phone: '+91 91234 56789',
      address: {
        street: '15, Ballygunge Circular Rd',
        city: 'Kolkata',
        state: 'West Bengal',
        postalCode: '700019',
        country: 'India'
      }
    },
    loanDetails: {
      loanType: 'home',
      amount: 3200000,
      tenureMonths: 180,
      interestRate: 8.5,
      monthlyEmiPreview: 31512,
      purpose: 'Purchase of 2BHK residential flat'
    },
    incomeDetails: {
      monthlyIncome: 95000,
      employmentType: 'salaried',
      employerName: 'Tata Consultancy Services',
      existingMonthlyEmi: 8000
    },
    documents: [
      {
        _id: 'doc_3',
        documentType: 'id_proof',
        fileName: 'Aadhaar_Priya.pdf',
        fileUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800',
        fileSize: 1245000,
        uploadedAt: '2026-11-21T14:15:00Z'
      },
      {
        _id: 'doc_4',
        documentType: 'income_proof',
        fileName: 'Form16_Priya.pdf',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
        fileSize: 3100000,
        uploadedAt: '2026-11-21T14:18:00Z'
      }
    ],
    eligibilityCheck: {
      isEligible: true,
      debtToIncomeRatio: 41.6,
      calculatedAge: 34,
      summary: 'Applicant passes all deterministic credit policy checks.',
      checkedAt: '2026-11-22T09:30:00Z',
      ruleResults: [
        { rule: 'Age Criteria', passed: true, message: 'Applicant age (34 yrs) is within 21-65 range.', actualValue: 34, threshold: '21 - 65 yrs' },
        { rule: 'Minimum Monthly Income', passed: true, message: 'Income (₹95,000) exceeds threshold of ₹40,000 for home loan.', actualValue: 95000, threshold: '₹40,000' },
        { rule: 'Debt-to-Income (DTI) Tolerance', passed: true, message: 'DTI ratio (41.6%) is within safe limits (<= 50%).', actualValue: '41.6%', threshold: '<= 50%' },
        { rule: 'Mandatory Document Verification', passed: true, message: 'Both ID proof and Income proof are verified.', actualValue: ['id_proof', 'income_proof'], threshold: ['id_proof', 'income_proof'] }
      ]
    },
    officerReview: null,
    adminDecision: null,
    createdAt: '2026-11-21T14:18:00Z'
  },
  {
    _id: 'app_65a103',
    applicationNumber: 'LMS-2026-7731',
    applicantId: {
      _id: 'usr_103',
      name: 'Vikas Aggarwal',
      email: 'vikas.aggarwal@example.com',
      phone: '+91 97110 11223'
    },
    status: 'recommended_approval',
    currentStep: 4,
    personalDetails: {
      fullName: 'Vikas Aggarwal',
      dateOfBirth: '1988-11-04',
      panNumber: 'DFGPA4432Q',
      phone: '+91 97110 11223',
      address: {
        street: '88, Sector 14',
        city: 'Gurugram',
        state: 'Haryana',
        postalCode: '122001',
        country: 'India'
      }
    },
    loanDetails: {
      loanType: 'vehicle',
      amount: 750000,
      tenureMonths: 48,
      interestRate: 9.5,
      monthlyEmiPreview: 18847,
      purpose: 'Purchase of electric SUV (Hyundai Creta EV)'
    },
    incomeDetails: {
      monthlyIncome: 80000,
      employmentType: 'business_owner',
      employerName: 'Aggarwal Logistics',
      existingMonthlyEmi: 0
    },
    documents: [
      {
        _id: 'doc_5',
        documentType: 'id_proof',
        fileName: 'Vikas_PAN.pdf',
        fileUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800',
        fileSize: 940000,
        uploadedAt: '2026-11-19T11:00:00Z'
      },
      {
        _id: 'doc_6',
        documentType: 'income_proof',
        fileName: 'ITR_FY2025_26.pdf',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
        fileSize: 2400000,
        uploadedAt: '2026-11-19T11:05:00Z'
      }
    ],
    eligibilityCheck: {
      isEligible: true,
      debtToIncomeRatio: 23.6,
      calculatedAge: 38,
      summary: 'Applicant passes all deterministic credit policy checks.',
      checkedAt: '2026-11-20T14:00:00Z',
      ruleResults: [
        { rule: 'Age Criteria', passed: true, message: 'Applicant age (38 yrs) within 21-65 yrs.', actualValue: 38, threshold: '21 - 65 yrs' },
        { rule: 'Minimum Monthly Income', passed: true, message: 'Income (₹80,000) meets ₹30,000 vehicle requirement.', actualValue: 80000, threshold: '₹30,000' },
        { rule: 'Debt-to-Income (DTI) Tolerance', passed: true, message: 'DTI (23.6%) well within 50% limit.', actualValue: '23.6%', threshold: '<= 50%' },
        { rule: 'Mandatory Document Verification', passed: true, message: 'All documents verified.', actualValue: ['id_proof', 'income_proof'], threshold: ['id_proof', 'income_proof'] }
      ]
    },
    officerReview: {
      recommendation: 'recommended_approval',
      remarks: 'Strong income profile, low debt obligation, verified business tax filings.',
      infoRequested: '',
      reviewedAt: '2026-11-21T16:45:00Z'
    },
    adminDecision: null,
    createdAt: '2026-11-19T11:05:00Z'
  },
  {
    _id: 'app_65a104',
    applicationNumber: 'LMS-2026-6619',
    applicantId: {
      _id: 'usr_104',
      name: 'Anjali Verma',
      email: 'anjali.verma@example.com',
      phone: '+91 99887 76655'
    },
    status: 'more_info_needed',
    currentStep: 4,
    personalDetails: {
      fullName: 'Anjali Verma',
      dateOfBirth: '1998-02-14',
      panNumber: 'KLPAV7766M',
      phone: '+91 99887 76655',
      address: {
        street: '12, Gomti Nagar',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        postalCode: '226010',
        country: 'India'
      }
    },
    loanDetails: {
      loanType: 'personal',
      amount: 300000,
      tenureMonths: 18,
      interestRate: 12.0,
      monthlyEmiPreview: 18296,
      purpose: 'Higher education course fee'
    },
    incomeDetails: {
      monthlyIncome: 32000,
      employmentType: 'salaried',
      employerName: 'Wipro',
      existingMonthlyEmi: 4000
    },
    documents: [
      {
        _id: 'doc_7',
        documentType: 'id_proof',
        fileName: 'Aadhaar_Card.pdf',
        fileUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800',
        fileSize: 850000,
        uploadedAt: '2026-11-18T09:00:00Z'
      }
    ],
    eligibilityCheck: {
      isEligible: false,
      debtToIncomeRatio: 69.7,
      calculatedAge: 28,
      summary: 'Application flagged on Debt-to-Income (DTI) Tolerance, Mandatory Document Verification.',
      checkedAt: '2026-11-19T12:00:00Z',
      ruleResults: [
        { rule: 'Age Criteria', passed: true, message: 'Applicant age (28 yrs) within range.', actualValue: 28, threshold: '21 - 65 yrs' },
        { rule: 'Minimum Monthly Income', passed: true, message: 'Income (₹32,000) meets ₹25,000 personal loan minimum.', actualValue: 32000, threshold: '₹25,000' },
        { rule: 'Debt-to-Income (DTI) Tolerance', passed: false, message: 'DTI (69.7%) exceeds maximum allowable (50%).', actualValue: '69.7%', threshold: '<= 50%' },
        { rule: 'Mandatory Document Verification', passed: false, message: 'Missing mandatory documents: Income Proof', actualValue: ['id_proof'], threshold: ['id_proof', 'income_proof'] }
      ]
    },
    officerReview: {
      recommendation: 'more_info_needed',
      remarks: 'Salary slip and 6 months bank statement missing. Current DTI exceeds safe threshold.',
      infoRequested: 'Please upload last 3 months salary slips and 6 months bank statement showing salary credits to verify disposable income.',
      reviewedAt: '2026-11-19T15:30:00Z'
    },
    applicantResponse: null,
    adminDecision: null,
    createdAt: '2026-11-18T09:00:00Z'
  },
  {
    _id: 'app_65a105',
    applicationNumber: 'LMS-2026-5501',
    applicantId: {
      _id: 'usr_105',
      name: 'Sunil Nair',
      email: 'sunil.nair@example.com',
      phone: '+91 94470 12345'
    },
    status: 'approved',
    currentStep: 4,
    personalDetails: {
      fullName: 'Sunil Nair',
      dateOfBirth: '1984-06-19',
      panNumber: 'ZXCVN5544R',
      phone: '+91 94470 12345',
      address: {
        street: '7, Marine Drive',
        city: 'Kochi',
        state: 'Kerala',
        postalCode: '682011',
        country: 'India'
      }
    },
    loanDetails: {
      loanType: 'business',
      amount: 1500000,
      tenureMonths: 24,
      interestRate: 14.0,
      monthlyEmiPreview: 72008,
      purpose: 'Inventory purchase for medical supplies store'
    },
    incomeDetails: {
      monthlyIncome: 210000,
      employmentType: 'business_owner',
      employerName: 'Nair Pharma Care',
      existingMonthlyEmi: 15000
    },
    documents: [
      {
        _id: 'doc_8',
        documentType: 'id_proof',
        fileName: 'Sunil_PAN.pdf',
        fileUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800',
        fileSize: 1100000,
        uploadedAt: '2026-11-15T10:00:00Z'
      },
      {
        _id: 'doc_9',
        documentType: 'income_proof',
        fileName: 'GST_Filings_2026.pdf',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800',
        fileSize: 4500000,
        uploadedAt: '2026-11-15T10:05:00Z'
      }
    ],
    eligibilityCheck: {
      isEligible: true,
      debtToIncomeRatio: 41.4,
      calculatedAge: 42,
      summary: 'Applicant passes all deterministic credit policy checks.',
      checkedAt: '2026-11-16T11:00:00Z',
      ruleResults: [
        { rule: 'Age Criteria', passed: true, message: 'Applicant age (42 yrs) within range.', actualValue: 42, threshold: '21 - 65 yrs' },
        { rule: 'Minimum Monthly Income', passed: true, message: 'Income (₹2,10,000) exceeds ₹50,000 business threshold.', actualValue: 210000, threshold: '₹50,000' },
        { rule: 'Debt-to-Income (DTI) Tolerance', passed: true, message: 'DTI (41.4%) within 50% limit.', actualValue: '41.4%', threshold: '<= 50%' },
        { rule: 'Mandatory Document Verification', passed: true, message: 'Verified.', actualValue: ['id_proof', 'income_proof'], threshold: ['id_proof', 'income_proof'] }
      ]
    },
    officerReview: {
      recommendation: 'recommended_approval',
      remarks: 'Audited GST records show strong monthly turnover. Recommend sanction.',
      infoRequested: '',
      reviewedAt: '2026-11-16T14:30:00Z'
    },
    adminDecision: {
      decision: 'approved',
      remarks: 'Sanctioned at 14.0% p.a. for 24 months. Disbursal initiated.',
      decidedAt: '2026-11-17T11:00:00Z'
    },
    createdAt: '2026-11-15T10:05:00Z'
  }
]

// Initial Repayment Schedule for the approved loan
const INITIAL_SCHEDULES = [
  {
    _id: 'sch_9901',
    applicationId: 'app_65a105',
    applicantId: 'usr_105',
    loanType: 'business',
    totalPrincipal: 1500000,
    annualInterestRate: 14.0,
    tenureMonths: 24,
    monthlyEmi: 72008,
    totalInterest: 228192,
    totalAmountPayable: 1728192,
    startDate: '2026-11-17T11:00:00Z',
    status: 'active',
    installments: Array.from({ length: 24 }, (_, idx) => {
      const num = idx + 1
      const isPaid = num <= 2
      const isOverdue = false
      return {
        installmentNumber: num,
        dueDate: new Date(2026, 11 + idx, 15).toISOString(),
        emiAmount: 72008,
        principalComponent: 54500 + num * 200,
        interestComponent: 17508 - num * 200,
        remainingPrincipal: Math.max(0, 1500000 - num * 55000),
        status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
        paidDate: isPaid ? new Date(2026, 11 + idx, 14).toISOString() : null,
        paymentReference: isPaid ? `UPI-TXN-998822${num}` : ''
      }
    })
  }
]

// Storage helpers
const getStoredApps = () => {
  try {
    const raw = localStorage.getItem('correm_lms_applications')
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  localStorage.setItem('correm_lms_applications', JSON.stringify(INITIAL_APPLICATIONS))
  return INITIAL_APPLICATIONS
}

const saveStoredApps = (apps) => {
  localStorage.setItem('correm_lms_applications', JSON.stringify(apps))
}

const getStoredSchedules = () => {
  try {
    const raw = localStorage.getItem('correm_lms_schedules')
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error(e)
  }
  localStorage.setItem('correm_lms_schedules', JSON.stringify(INITIAL_SCHEDULES))
  return INITIAL_SCHEDULES
}

const saveStoredSchedules = (schedules) => {
  localStorage.setItem('correm_lms_schedules', JSON.stringify(schedules))
}

// 1. Fetch Applications (with filters & search)
export const getApplications = async (filters = {}) => {
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

// 2. Fetch Single Application
export const getApplicationById = async (id) => {
  const apps = getStoredApps()
  return apps.find((a) => a._id === id) || null
}

// 3. Run Rule-Based Deterministic Eligibility Check
export const runEligibilityCheck = async (id, officerName = 'Officer Jane Doe') => {
  const apps = getStoredApps()
  const index = apps.findIndex((a) => a._id === id)
  if (index === -1) throw new Error('Application not found')

  const app = apps[index]
  const income = Number(app.incomeDetails?.monthlyIncome) || 0
  const existingEmi = Number(app.incomeDetails?.existingMonthlyEmi) || 0
  const proposedEmi = Number(app.loanDetails?.monthlyEmiPreview) || 0
  const totalEmi = existingEmi + proposedEmi
  const dti = income > 0 ? (totalEmi / income) * 100 : 100

  // Calculate age
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

// 4. Submit Loan Officer Review
export const submitOfficerReview = async (id, { recommendation, remarks, infoRequested }, officerName = 'Officer Jane Doe') => {
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

// 5. Submit Admin Final Decision (Approve / Reject)
export const submitAdminDecision = async (id, { decision, remarks }, adminName = 'Admin Chief Credit Officer') => {
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

  // If approved, auto-generate the complete EMI repayment schedule
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

// 6. Fetch Repayment Schedule by Application ID
export const getRepaymentSchedule = async (applicationId) => {
  const schedules = getStoredSchedules()
  return schedules.find((s) => s.applicationId === applicationId) || null
}

// 7. Update Installment Status (Admin Bonus: Mark Paid / Overdue)
export const updateInstallmentStatus = async (scheduleId, installmentNumber, { status, paymentReference, remarks }) => {
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

// 8. Applicant Respond to More Info Needed
export const respondToMoreInfo = async (id, { responseText, newDocumentName }) => {
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

// 9. Save Application as Draft (Supports Multi-Step Resumption)
export const saveDraftApplication = async (payload) => {
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

// 10. Submit Application (Transitions Draft -> Submitted)
export const submitNewApplication = async (payload) => {
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

export default {
  getApplications,
  getApplicationById,
  runEligibilityCheck,
  submitOfficerReview,
  submitAdminDecision,
  getRepaymentSchedule,
  updateInstallmentStatus,
  respondToMoreInfo,
  saveDraftApplication,
  submitNewApplication
}
