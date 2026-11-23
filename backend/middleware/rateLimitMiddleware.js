import rateLimit from "express-rate-limit"

// 1. General API Rate Limiter (300 requests per 15 minutes)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes"
  }
})

// 2. Sensitive Auth & Sync Rate Limiter (60 requests per 15 minutes)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication requests, please try again after 15 minutes"
  }
})

// 3. Document Upload Rate Limiter (30 uploads per 15 minutes)
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "File upload rate limit reached. Please wait before uploading more documents."
  }
})
