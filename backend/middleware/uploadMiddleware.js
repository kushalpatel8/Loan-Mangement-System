import multer from "multer"
import path from "path"
import fs from "fs"
import { AppError } from "./errorMiddleware.js"

// Target directory for uploaded documents
const uploadDir = path.resolve(process.cwd(), "uploads", "documents")

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Disk Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Generate clean, sanitized, unique filename: doc-<timestamp>-<random><extension>
    const ext = path.extname(file.originalname).toLowerCase()
    const sanitizedBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 30)
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`
    cb(null, `doc_${sanitizedBase}_${uniqueSuffix}${ext}`)
  }
})

// File Filter: Allow only PDF and image formats (JPEG, PNG, WebP)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
  ]

  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true)
  } else {
    cb(
      new AppError(
        `Invalid file type: ${file.mimetype}. Only PDF, JPG, PNG, and WebP files are allowed.`,
        400
      ),
      false
    )
  }
}

// 10MB maximum file size limit
const limits = {
  fileSize: 10 * 1024 * 1024 // 10 Megabytes
}

export const upload = multer({
  storage,
  fileFilter,
  limits
})

// Convenience Middleware Helpers
export const uploadSingle = (fieldName = "document") => upload.single(fieldName)
export const uploadMultiple = (fieldName = "documents", maxCount = 5) =>
  upload.array(fieldName, maxCount)
export const uploadFields = (fieldsConfig) => upload.fields(fieldsConfig)
