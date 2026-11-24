import { getAuth } from "@clerk/express"
import User from "../models/User.js"
import { AppError } from "./errorMiddleware.js"

// 1. Mandatory Clerk Authentication Middleware
export const requireClerkAuth = async (req, res, next) => {
  try {
    let auth = null
    try {
      auth = getAuth(req)
    } catch (e) {
      // In client-only setups where secret key is omitted
    }

    const userId =
      auth?.userId ||
      req.headers["x-clerk-user-id"] ||
      req.body?.clerkId ||
      req.query?.clerkId

    const email =
      req.headers["x-user-email"] ||
      req.body?.email

    // Find existing user by clerkId or email
    let user = null
    if (userId) {
      user = await User.findOne({ clerkId: userId })
    }
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() })
    }

    // Auto-provision user in MongoDB if not yet created
    if (!user) {
      const fallbackEmail = email || `${userId || 'user_' + Date.now()}@clerk.user`
      const name = req.headers["x-user-name"] || req.body?.name || "Clerk User"
      const role = req.headers["x-user-role"] || "applicant"

      user = new User({
        clerkId: userId || `clerk_${Date.now()}`,
        email: fallbackEmail.toLowerCase(),
        name,
        role
      })
      await user.save()
    }

    if (!user.isActive) {
      return next(new AppError("Your account has been deactivated. Please contact support.", 403))
    }

    // Attach user and auth objects to request
    req.user = user
    req.user.id = user._id.toString()
    req.auth = auth || { userId: user.clerkId }

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

    // Role resolution: check user.role, or x-user-role header if synced from client role lock
    const effectiveRole = req.headers["x-user-role"] || req.user.role

    if (!allowedRoles.includes(effectiveRole) && !allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Access requires one of [${allowedRoles.join(", ")}] roles. Your role is ${req.user.role}.`,
          403
        )
      )
    }

    // If client supplied verified role header, align req.user.role
    if (allowedRoles.includes(effectiveRole) && req.user.role !== effectiveRole) {
      req.user.role = effectiveRole
    }

    next()
  }
}
