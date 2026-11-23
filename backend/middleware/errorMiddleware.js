// Custom Operational Error Class
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode || 500
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error"
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

// 1. 404 Route Not Found Handler
export const notFoundHandler = (req, res, next) => {
  const err = new AppError(`Resource not found at ${req.originalUrl}`, 404)
  next(err)
}

// 2. Centralized Global Error Handling Middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err }
  error.message = err.message
  error.statusCode = err.statusCode || 500

  // Log error in server logs
  if (process.env.NODE_ENV !== "test") {
    console.error(`[ERROR] ${req.method} ${req.url} ->`, err.message)
  }

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === "CastError") {
    const message = `Invalid ${err.path}: ${err.value}`
    error = new AppError(message, 400)
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field"
    const value = err.keyValue ? err.keyValue[field] : ""
    const message = `Duplicate value '${value}' entered for ${field}. Please use another value.`
    error = new AppError(message, 409)
  }

  // Handle Mongoose Schema Validation Errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((val) => val.message)
    const message = `Validation error: ${messages.join(", ")}`
    error = new AppError(message, 400)
    error.validationErrors = Object.keys(err.errors).reduce((acc, key) => {
      acc[key] = err.errors[key].message
      return acc
    }, {})
  }

  // Handle Multer File Upload Errors
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      error = new AppError("File size exceeds the 10MB limit", 400)
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      error = new AppError("Unexpected file field in upload request", 400)
    } else {
      error = new AppError(`File upload error: ${err.message}`, 400)
    }
  }

  // Handle Clerk / JWT Authentication Errors
  if (err.name === "UnauthorizedError" || err.message?.includes("Clerk")) {
    error = new AppError("Authentication failed or session expired", 401)
  }

  // Response payload
  const statusCode = error.statusCode || 500
  const response = {
    success: false,
    message: error.message || "Internal Server Error",
    ...(error.validationErrors && { errors: error.validationErrors })
  }

  // Include stack trace only in development
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack
  }

  return res.status(statusCode).json(response)
}
