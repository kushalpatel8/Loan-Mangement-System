import { Router } from "express"
import { syncUser, getMe, updateProfile, selectRole, handleClerkWebhook } from "../controllers/authController.js"
import { requireClerkAuth } from "../middleware/authMiddleware.js"
import { authLimiter } from "../middleware/rateLimitMiddleware.js"

const router = Router()

// Public / Clerk authentication endpoints
router.post("/sync", authLimiter, syncUser)
router.post("/webhook", handleClerkWebhook)

// Protected user routes
router.get("/me", requireClerkAuth, getMe)
router.post("/select-role", requireClerkAuth, selectRole)
router.put("/profile", requireClerkAuth, updateProfile)

export default router
