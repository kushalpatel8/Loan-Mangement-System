import { getAuth } from "@clerk/express"
import User from "../models/User.js"
import { AppError } from "./errorMiddleware.js"

// 1. Mandatory Clerk Authentication Middleware
export const requireClerkAuth = async (req, res, next) => {
  try {
    const auth = getAuth(req)

    if (!auth || !auth.userId) {
      return next(new AppError("Unauthorized: Missing or invalid authentication token", 401))
    }

    // Look up user in MongoDB
    let user = await User.findOne({ clerkId: auth.userId })

    // Auto-provision user in MongoDB if not yet created
    if (!user) {
      const email = req.headers["x-user-email"] || `${auth.userId}@clerk.user`
      const name = req.headers["x-user-name"] || "Clerk User"

      user = new User({
        clerkId: auth.userId,
        email: email.toLowerCase(),
        name,
        role: "applicant"
      })
      await user.save()
    }

    if (!user.isActive) {
      return next(new AppError("Your account has been deactivated. Please contact support.", 403))
    }

    // Attach user and auth objects to request
    req.user = user
    req.user.id = user._id.toString()
    req.auth = auth

    next()
  } catch (error) {
    console.error("Clerk auth middleware error:", error)
    return next(new AppError(error.message || "Authentication failed", 500))
  }
}

// 2. Optional Clerk Authentication Middleware (For endpoints accessible by both guests and users)
export const optionalClerkAuth = async (req, res, next) => {
  try {
    const auth = getAuth(req)
    if (auth && auth.userId) {
      const user = await User.findOne({ clerkId: auth.userId })
      if (user && user.isActive) {
        req.user = user
        req.user.id = user._id.toString()
        req.auth = auth
      }
    }
    next()
  } catch {
    next()
  }
}

// 3. Role-Based Access Control (RBAC) Middleware
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Unauthorized: User is not authenticated", 401))
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Access requires one of [${allowedRoles.join(", ")}] roles. Your role is ${req.user.role}.`,
          403
        )
      )
    }

    next()
  }
}
