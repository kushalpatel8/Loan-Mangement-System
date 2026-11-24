
import { v2 as cloudinary } from "cloudinary"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"

// Robust multi-path env loader
const envBackend = path.resolve(process.cwd(), "backend", ".env")
const envCwd = path.resolve(process.cwd(), ".env")

if (fs.existsSync(envBackend)) {
  dotenv.config({ path: envBackend })
}
if (fs.existsSync(envCwd)) {
  dotenv.config({ path: envCwd })
}
dotenv.config()

// Helper: parse CLOUDINARY_URL format: cloudinary://<api_key>:<api_secret>@<cloud_name>
const parseCloudinaryUrl = (urlStr) => {
  if (!urlStr) return null
  try {
    const match = urlStr.trim().match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/)
    if (match) {
      return {
        api_key: match[1],
        api_secret: match[2],
        cloud_name: match[3]
      }
    }
  } catch (err) {
    console.warn("Could not parse CLOUDINARY_URL:", err.message)
  }
  return null
}

export const initCloudinary = () => {
  const parsedFromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL)

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || parsedFromUrl?.cloud_name
  const apiKey = process.env.CLOUDINARY_API_KEY || parsedFromUrl?.api_key
  const apiSecret = process.env.CLOUDINARY_API_SECRET || parsedFromUrl?.api_secret

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    })
  }

  return cloudinary
}

// Auto-initialize on load
initCloudinary()

/**
 * Upload a local file to Cloudinary
 * @param {string} filePath - Absolute path to local file on disk
 * @param {object} options - Optional cloudinary upload settings
 * @returns {Promise<{ url: string, publicId: string, bytes: number, format: string }>}
 */
export const uploadFileToCloudinary = async (filePath, options = {}) => {
  initCloudinary()
  const cfg = cloudinary.config()

  if (!cfg.cloud_name || !cfg.api_key) {
    throw new Error("Cloudinary configuration missing. Please verify CLOUDINARY_URL in .env")
  }

  // Determine correct resource_type for Cloudinary:
  // PDFs must use 'raw' to avoid ImageMagick/Ghostscript rasterization rejection
  const ext = path.extname(filePath).toLowerCase()
  const isPdf = ext === ".pdf" || options.mimeType === "application/pdf"
  const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)
  const resourceType = options.resource_type || (isPdf ? "raw" : isImage ? "image" : "auto")

  const defaultOptions = {
    folder: "loan_management_system/documents",
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    ...options,
    resource_type: resourceType
  }

  const result = await cloudinary.uploader.upload(filePath, defaultOptions)

  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    bytes: result.bytes,
    format: result.format
  }
}

/**
 * Upload a file Buffer directly to Cloudinary using upload_stream
 * @param {Buffer} buffer - File buffer
 * @param {object} options - Cloudinary options
 * @returns {Promise<{ url: string, publicId: string, bytes: number, format: string }>}
 */
export const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    initCloudinary()
    const isPdf = options.fileName?.toLowerCase().endsWith(".pdf") || options.mimeType === "application/pdf"
    const resourceType = options.resource_type || (isPdf ? "raw" : "auto")

    const defaultOptions = {
      folder: "loan_management_system/documents",
      resource_type: resourceType,
      ...options,
      resource_type: resourceType
    }

    const stream = cloudinary.uploader.upload_stream(defaultOptions, (error, result) => {
      if (error) return reject(error)
      resolve({
        url: result.secure_url || result.url,
        publicId: result.public_id,
        bytes: result.bytes,
        format: result.format
      })
    })

    stream.end(buffer)
  })
}

/**
 * Delete a file from Cloudinary by public ID
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise<any>}
 */
export const deleteFileFromCloudinary = async (publicId) => {
  if (!publicId) return null
  initCloudinary()
  return cloudinary.uploader.destroy(publicId)
}

export default cloudinary
