import { Router } from "express"
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserStatus
} from "../controllers/userController.js"
import { requireClerkAuth, requireRole } from "../middleware/authMiddleware.js"

const router = Router()

// All user management endpoints are Admin-only
router.use(requireClerkAuth, requireRole("admin"))

router.get("/", getAllUsers)
router.get("/:id", getUserById)
router.patch("/:id/role", updateUserRole)
router.patch("/:id/status", toggleUserStatus)

export default router
