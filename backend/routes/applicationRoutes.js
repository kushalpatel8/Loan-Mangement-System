import { Router } from "express"
import {
  calculateEmiPreview,
  saveDraft,
  submitApplication,
  getMyApplications,
  getApplicationById,
  getAllApplications,
  respondToMoreInfo
} from "../controllers/applicationController.js"
import { requireClerkAuth, requireRole } from "../middleware/authMiddleware.js"
import { validateDraft, validateSubmission } from "../middleware/validationMiddleware.js"
import { uploadMultiple } from "../middleware/uploadMiddleware.js"
import { uploadLimiter } from "../middleware/rateLimitMiddleware.js"

const router = Router()

// Public EMI Calculator preview
router.post("/emi-preview", calculateEmiPreview)

// Protected Applicant & Officer routes
router.use(requireClerkAuth)

// Applicant drafts & submissions
router.post("/draft", validateDraft, saveDraft)
router.post("/:id/submit", validateSubmission, submitApplication)
router.get("/my", getMyApplications)

// Document upload endpoint for applications
router.post("/:id/upload", uploadLimiter, uploadMultiple("documents", 5), async (req, res, next) => {
  try {
    const LoanApplication = (await import("../models/LoanApplication.js")).default
    const { id } = req.params
    const documentType = req.body.documentType || "other"

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" })
    }

    const application = await LoanApplication.findOne({ _id: id, applicantId: req.user.id })
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" })
    }

    const uploadedDocs = req.files.map((file) => ({
      documentType,
      fileName: file.originalname,
      fileUrl: `/uploads/documents/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date()
    }))

    application.documents.push(...uploadedDocs)
    await application.save()

    return res.status(200).json({
      success: true,
      message: `${uploadedDocs.length} document(s) uploaded successfully`,
      documents: application.documents
    })
  } catch (error) {
    next(error)
  }
})

// Applicant respond to more info requested
router.post("/:id/respond-info", respondToMoreInfo)

// Single application details (Access checked inside controller)
router.get("/:id", getApplicationById)

// Officer & Admin application queue listing
router.get("/", requireRole("loan_officer", "admin"), getAllApplications)

export default router
