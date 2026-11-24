import mongoose from "mongoose"
import LoanApplication from "../models/LoanApplication.js"
import AuditLog from "../models/AuditLog.js"

// Helper: Calculate EMI
export const calculateEmi = (principal, annualRate, tenureMonths) => {
  const P = Number(principal) || 0
  const n = Number(tenureMonths) || 1
  const r = (Number(annualRate) || 0) / 12 / 100

  if (P <= 0 || n <= 0) return 0
  if (r === 0) return Math.round(P / n)

  const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return Math.round(emi)
}

// 1. Calculate EMI preview endpoint
export const calculateEmiPreview = async (req, res) => {
  try {
    const { amount, tenureMonths, interestRate } = req.body

    if (!amount || !tenureMonths || typeof interestRate === "undefined") {
      return res.status(400).json({ success: false, message: "amount, tenureMonths, and interestRate are required" })
    }

    const emi = calculateEmi(amount, interestRate, tenureMonths)
    const totalAmount = emi * tenureMonths
    const totalInterest = totalAmount - amount

    return res.status(200).json({
      success: true,
      monthlyEmi: emi,
      totalInterest,
      totalAmount
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 2. Save Application Draft (Multi-Step & Resume Support)
export const saveDraft = async (req, res) => {
  try {
    const applicantId = req.user.id
    const {
      applicationId,
      currentStep,
      personalDetails,
      loanDetails,
      incomeDetails,
      documents
    } = req.body

    let application

    if (applicationId && mongoose.Types.ObjectId.isValid(applicationId)) {
      application = await LoanApplication.findOne({ _id: applicationId, applicantId })
      if (!application) {
        return res.status(404).json({ success: false, message: "Draft application not found" })
      }
      if (application.status !== "draft") {
        return res.status(400).json({ success: false, message: "Cannot edit an already submitted application" })
      }
    } else {
      application = new LoanApplication({
        applicantId,
        isDraft: true,
        status: "draft"
      })
    }

    if (currentStep) application.currentStep = currentStep
    if (personalDetails) application.personalDetails = { ...application.personalDetails?.toObject?.() || {}, ...personalDetails }
    if (incomeDetails) application.incomeDetails = { ...application.incomeDetails?.toObject?.() || {}, ...incomeDetails }
    if (documents) application.documents = documents

    if (loanDetails) {
      application.loanDetails = { ...application.loanDetails?.toObject?.() || {}, ...loanDetails }
      // Auto compute EMI preview
      const emi = calculateEmi(
        application.loanDetails.amount,
        application.loanDetails.interestRate,
        application.loanDetails.tenureMonths
      )
      application.loanDetails.monthlyEmiPreview = emi
    }

    await application.save()

    // Log audit trail
    await AuditLog.create({
      applicationId: application._id,
      action: applicationId ? "DRAFT_SAVED" : "APPLICATION_CREATED",
      fromStatus: "draft",
      toStatus: "draft",
      performedBy: req.user.id,
      userRole: req.user.role,
      remarks: `Draft updated at step ${application.currentStep}`,
      metadata: { currentStep: application.currentStep }
    })

    return res.status(200).json({
      success: true,
      message: "Application draft saved successfully",
      application
    })
  } catch (error) {
    console.error("Save draft error:", error)
    return res.status(500).json({ success: false, message: error.message || "Failed to save draft" })
  }
}

// 3. Submit Application
export const submitApplication = async (req, res) => {
  try {
    const applicantId = req.user.id
    const { id } = req.params

    let application = null
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      application = await LoanApplication.findOne({ _id: id, applicantId })
    }

    // Direct submission or fallback to existing draft
    if (!application) {
      if (req.body && (req.body.personalDetails || req.body.loanDetails)) {
        application = new LoanApplication({
          applicantId,
          isDraft: true,
          status: "draft",
          personalDetails: req.body.personalDetails || {},
          loanDetails: req.body.loanDetails || {},
          incomeDetails: req.body.incomeDetails || {},
          documents: req.body.documents || []
        })
      } else {
        application = await LoanApplication.findOne({ applicantId, status: "draft" }).sort({ createdAt: -1 })
      }
    }

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" })
    }

    // Merge any updated payload fields provided in request body
    if (req.body?.personalDetails) application.personalDetails = { ...application.personalDetails?.toObject?.() || {}, ...req.body.personalDetails }
    if (req.body?.loanDetails) application.loanDetails = { ...application.loanDetails?.toObject?.() || {}, ...req.body.loanDetails }
    if (req.body?.incomeDetails) application.incomeDetails = { ...application.incomeDetails?.toObject?.() || {}, ...req.body.incomeDetails }
    if (req.body?.documents) application.documents = req.body.documents

    if (application.status !== "draft" && application.status !== "submitted") {
      return res.status(400).json({ success: false, message: `Application is already ${application.status}` })
    }

    // Validate essential submission details
    if (!application.personalDetails?.fullName || !application.personalDetails?.panNumber) {
      return res.status(400).json({ success: false, message: "Personal details (Full Name, PAN) are required before submission" })
    }

    if (!application.loanDetails?.amount || application.loanDetails?.amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid loan amount is required" })
    }

    if (!application.incomeDetails?.monthlyIncome || application.incomeDetails?.monthlyIncome <= 0) {
      return res.status(400).json({ success: false, message: "Monthly income details are required" })
    }

    // Ensure EMI preview is up to date
    application.loanDetails.monthlyEmiPreview = calculateEmi(
      application.loanDetails.amount,
      application.loanDetails.interestRate,
      application.loanDetails.tenureMonths
    )

    const previousStatus = application.status
    application.status = "submitted"
    application.isDraft = false
    await application.save()

    // Audit Log
    await AuditLog.create({
      applicationId: application._id,
      action: "APPLICATION_SUBMITTED",
      fromStatus: previousStatus,
      toStatus: "submitted",
      performedBy: req.user.id,
      userRole: req.user.role,
      remarks: `Loan application ${application.applicationNumber} submitted by applicant.`
    })

    return res.status(200).json({
      success: true,
      message: "Application submitted successfully for review",
      application
    })
  } catch (error) {
    console.error("Submit application error:", error)
    return res.status(500).json({ success: false, message: error.message || "Failed to submit application" })
  }
}

// 4. Get Applicant's Own Applications (Applicant Dashboard)
export const getMyApplications = async (req, res) => {
  try {
    const applicantId = req.user.id
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10))
    const skip = (page - 1) * limit

    const { status, loanType } = req.query
    const userEmail = (req.user.email || req.query.email || "").toLowerCase().trim()

    // Strict applicant scoping:
    // User can only see applications belonging to their own user ID or their verified email address
    const filter = {
      $or: [
        { applicantId },
        ...(userEmail ? [{ "personalDetails.email": userEmail }] : [])
      ]
    }

    if (status) filter.status = status
    if (loanType) filter["loanDetails.loanType"] = loanType

    const [applications, total] = await Promise.all([
      LoanApplication.find(filter)
        .populate("applicantId", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LoanApplication.countDocuments(filter)
    ])

    // Strict server-side verification: exclude any record where email belongs to a different applicant
    const isolatedApplications = applications.filter((app) => {
      const appEmail = (app.applicantId?.email || app.personalDetails?.email || "").toLowerCase().trim()
      const appApplicantId = (app.applicantId?._id || app.applicantId || "").toString()
      
      // If userEmail is known, and app has an email, it MUST match userEmail
      if (userEmail && appEmail && appEmail !== userEmail) {
        return false // Belongs to a different applicant!
      }
      return appApplicantId === req.user.id || (userEmail && appEmail === userEmail)
    })

    return res.status(200).json({
      success: true,
      data: isolatedApplications,
      pagination: {
        total: isolatedApplications.length,
        page,
        limit,
        totalPages: Math.ceil(isolatedApplications.length / limit)
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 5. Get Single Application by ID (With Access Control)
export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params
    const application = await LoanApplication.findById(id)
      .populate("applicantId", "name email phone")
      .populate("officerReview.reviewedBy", "name email role")
      .populate("adminDecision.decidedBy", "name email role")

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" })
    }

    // Role check: Applicant can strictly only view their own
    if (req.user.role === "applicant") {
      const appApplicantId = (application.applicantId?._id || application.applicantId || "").toString()
      const appEmail = (application.applicantId?.email || application.personalDetails?.email || "").toLowerCase().trim()
      const userEmail = (req.user.email || "").toLowerCase().trim()

      if (appApplicantId !== req.user.id && (!userEmail || appEmail !== userEmail)) {
        return res.status(403).json({ success: false, message: "Access denied to this application" })
      }
    }

    // Fetch chronological audit timeline
    const auditTrail = await AuditLog.find({ applicationId: id })
      .populate("performedBy", "name email role")
      .sort({ createdAt: 1 })

    return res.status(200).json({
      success: true,
      application,
      auditTrail
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 6. Get All Applications (Officer / Admin list with filters & pagination)
export const getAllApplications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10))
    const skip = (page - 1) * limit

    const { status, loanType, startDate, endDate, q } = req.query
    const filter = {}

    // Exclude drafts from officer/admin queue by default unless explicitly asked
    if (status) {
      filter.status = status
    } else {
      filter.status = { $ne: "draft" }
    }

    if (loanType) {
      filter["loanDetails.loanType"] = loanType
    }

    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate) filter.createdAt.$lte = new Date(endDate)
    }

    if (q) {
      filter.$or = [
        { applicationNumber: { $regex: q.trim(), $options: "i" } },
        { "personalDetails.fullName": { $regex: q.trim(), $options: "i" } },
        { "personalDetails.panNumber": { $regex: q.trim(), $options: "i" } }
      ]
    }

    const [applications, total] = await Promise.all([
      LoanApplication.find(filter)
        .populate("applicantId", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LoanApplication.countDocuments(filter)
    ])

    return res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 7. Applicant Response to "More Info Needed"
export const respondToMoreInfo = async (req, res) => {
  try {
    const applicantId = req.user.id
    const { id } = req.params
    const { responseText, additionalDocuments } = req.body

    const application = await LoanApplication.findOne({ _id: id, applicantId })
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" })
    }

    if (application.status !== "more_info_needed") {
      return res.status(400).json({
        success: false,
        message: `Application is not in 'more_info_needed' state (current: ${application.status})`
      })
    }

    application.applicantResponse = {
      responseText: responseText || "",
      respondedAt: new Date(),
      additionalDocuments: additionalDocuments || []
    }

    // Append newly uploaded documents to the master document list
    if (Array.isArray(additionalDocuments) && additionalDocuments.length > 0) {
      application.documents.push(...additionalDocuments)
    }

    const previousStatus = application.status
    application.status = "under_review"
    await application.save()

    // Audit log
    await AuditLog.create({
      applicationId: application._id,
      action: "MORE_INFO_SUBMITTED",
      fromStatus: previousStatus,
      toStatus: "under_review",
      performedBy: req.user.id,
      userRole: req.user.role,
      remarks: responseText || "Applicant provided requested documentation."
    })

    return res.status(200).json({
      success: true,
      message: "Additional information submitted successfully. Application is under review.",
      application
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
