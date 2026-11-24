import multer from "multer"
import path from "path"
import { AppError } from "./errorMiddleware.js"

// In-Memory Storage Configuration for direct MongoDB Atlas storage
const storage = multer.memoryStorage()

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
