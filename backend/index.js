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

// Connect to MongoDB
connectDB()

// Enable CORS for frontend applications
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-email", "x-user-name"]
  })
)

// Body parsers
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Serve uploaded documents statically (e.g. for officer / admin document previews)
const uploadsPath = path.resolve(process.cwd(), "uploads")
app.use("/uploads", express.static(uploadsPath))

// Attach Clerk authentication middleware to all requests
app.use(clerkMiddleware())

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

app.listen(port, () => {
  console.log(`LMS Server running on port ${port}`)
})

export default app
