import { Router } from "express"
import {
  calculateEmiPreview,
  saveDraft,
  submitApplication,
  getMyApplications,
  getApplicationById,
  getAllApplications,
  respondToMoreInfo,
  exportApplicationCsv,
  requestReconsideration
} from "../controllers/applicationController.js"
import { requireClerkAuth, requireRole } from "../middleware/authMiddleware.js"
import { validateDraft, validateSubmission } from "../middleware/validationMiddleware.js"
import { uploadMultiple } from "../middleware/uploadMiddleware.js"
import { uploadLimiter } from "../middleware/rateLimitMiddleware.js"
import { uploadFileToCloudinary } from "../config/cloudinary.js"
import DocumentFile from "../models/DocumentFile.js"

const router = Router()

// Public EMI Calculator preview
router.post("/emi-preview", calculateEmiPreview)

// Stream document directly from MongoDB Atlas binary storage (Public stream for iframes, previews & downloads)
router.get("/document/:id", async (req, res, next) => {
  try {
    const { id } = req.params
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(404).json({ success: false, message: "Invalid document ID" })
    }

    const doc = await DocumentFile.findById(id)
    if (!doc || !doc.data) {
      return res.status(404).json({ success: false, message: "Document not found" })
    }

    res.setHeader("Content-Type", doc.mimeType || "application/pdf")
    res.setHeader("Content-Length", doc.fileSize || doc.data.length)
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.fileName)}"`)
    res.setHeader("Cache-Control", "public, max-age=86400")
    return res.send(doc.data)
  } catch (error) {
    next(error)
  }
})

// Standalone document upload endpoint (Uploads directly to MongoDB)
router.post("/upload-document", uploadLimiter, uploadMultiple("documents", 5), async (req, res, next) => {
  try {
    const documentType = req.body.documentType || "other"

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" })
    }

    const uploadedDocs = await Promise.all(
      req.files.map(async (file) => {
        // Save file binary data directly into MongoDB DocumentFile collection
        const docRecord = await DocumentFile.create({
          fileName: file.originalname,
          documentType,
          mimeType: file.mimetype || "application/pdf",
          fileSize: file.size,
          data: file.buffer,
          uploadedBy: req.user?.id || null
        })

        const fileUrl = `/api/v1/applications/document/${docRecord._id}`

        return {
          _id: docRecord._id.toString(),
          documentType,
          fileName: file.originalname,
          fileUrl,
          fileSize: file.size,
          mimeType: file.mimetype || "application/pdf",
          uploadedAt: docRecord.createdAt
        }
      })
    )

    return res.status(200).json({
      success: true,
      message: `${uploadedDocs.length} document(s) uploaded successfully to MongoDB`,
      documents: uploadedDocs
    })
  } catch (error) {
    next(error)
  }
})

// Protected Applicant & Officer routes
router.use(requireClerkAuth)

// Applicant drafts & submissions
router.post("/draft", validateDraft, saveDraft)
router.post("/submit", submitApplication)
router.post("/:id/submit", submitApplication)
router.get("/my", getMyApplications)

// Officer & Admin application queue listing (Placed before /:id)
router.get("/", requireRole("loan_officer", "admin", "officer", "applicant"), getAllApplications)

// Document upload endpoint for existing applications
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

    const uploadedDocs = await Promise.all(
      req.files.map(async (file) => {
        const docRecord = await DocumentFile.create({
          fileName: file.originalname,
          documentType,
          mimeType: file.mimetype || "application/pdf",
          fileSize: file.size,
          data: file.buffer,
          uploadedBy: req.user?.id || null
        })

        return {
          _id: docRecord._id.toString(),
          documentType,
          fileName: file.originalname,
          fileUrl: `/api/v1/applications/document/${docRecord._id}`,
          fileSize: file.size,
          mimeType: file.mimetype || "application/pdf",
          uploadedAt: docRecord.createdAt
        }
      })
    )

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

// Applicant request reconsideration for rejected application
router.post("/:id/request-reconsideration", requestReconsideration)

// Export applicant loan summary as CSV
router.get("/:id/export-csv", exportApplicationCsv)

// Single application details (Access checked inside controller)
router.get("/:id", getApplicationById)

export default router
