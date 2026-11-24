import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import path from "path"
import { clerkMiddleware } from "@clerk/express"
import connectDB from "./config/db.js"
import authRoutes from "./routes/authRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import applicationRoutes from "./routes/applicationRoutes.js"
import reviewRoutes from "./routes/reviewRoutes.js"
import repaymentRoutes from "./routes/repaymentRoutes.js"
import { notFoundHandler, errorHandler } from "./middleware/errorMiddleware.js"
import { apiLimiter } from "./middleware/rateLimitMiddleware.js"

dotenv.config()

const app = express()
const port = process.env.PORT || 5000

// Trust reverse proxy (Required for Vercel & express-rate-limit)
app.set("trust proxy", 1)

// Connect to MongoDB
connectDB()

// Middleware to ensure DB connection is active before servicing requests in serverless environments
app.use(async (req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (err) {
    next(err)
  }
})

// Allowed CORS origins
const allowedOrigins = [
  "https://frontend-xi-steel-92.vercel.app",
  "https://loan-mangement-system.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL
]
  .filter(Boolean)
  .map((url) => url.replace(/\/$/, ""))

// Enable CORS for frontend applications (handles standard requests & preflights)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const cleanOrigin = origin.replace(/\/$/, "")
      if (
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith(".vercel.app")
      ) {
        return callback(null, true)
      }
      return callback(null, true) // Permissive fallback for preview branches
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-user-email",
      "x-user-name",
      "x-user-role",
      "x-clerk-user-id"
    ]
  })
)

// Body parsers
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Serve uploaded documents statically (e.g. for officer / admin document previews)
const uploadsPath = path.resolve(process.cwd(), "uploads")
app.use("/uploads", express.static(uploadsPath))

// Attach Clerk authentication middleware (Works with or without backend secret key)
const publishableKey =
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  "pk_test_YXB0LW11bGUtNzU0OS5jbGVyay5hY2NvdW50cy5kZXYk"
const secretKey = process.env.CLERK_SECRET_KEY

// If secret key is present, use Clerk express middleware; otherwise allow client token passthrough
if (secretKey) {
  app.use(
    clerkMiddleware({
      publishableKey,
      secretKey
    })
  )
} else {
  // Client-only Clerk setup: extract auth from headers seamlessly
  app.use((req, res, next) => {
    req.auth = req.auth || {}
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith("Bearer ")) {
      req.auth.token = authHeader.split(" ")[1]
    }
    next()
  })
}

// Apply standard API rate limiting to API routes
app.use("/api", apiLimiter)

// Mount API v1 routes directly
app.use("/api/v1/auth", authRoutes)
app.use("/api/v1/users", userRoutes)
app.use("/api/v1/applications", applicationRoutes)
app.use("/api/v1/reviews", reviewRoutes)
app.use("/api/v1/repayments", repaymentRoutes)

// API v1 Health Check Endpoint
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Correm LMS API is operational",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  })
})

// Root Health Check Endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Correm Advisory Loan Management System (LMS) API is live",
    docs: "/api/v1/health"
  })
})

// Centralized Error Handling
app.use(notFoundHandler)
app.use(errorHandler)

// Only start local listener when not running in Vercel serverless environment
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`LMS Server running on port ${port}`)
  })
}

export default app
