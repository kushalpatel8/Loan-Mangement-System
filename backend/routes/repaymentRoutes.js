import { Router } from "express"
import {
  getScheduleByApplicationId,
  getMySchedules,
  getAllSchedules,
  updateInstallmentStatus
} from "../controllers/repaymentController.js"
import { requireClerkAuth, requireRole } from "../middleware/authMiddleware.js"
import { validateInstallmentUpdate } from "../middleware/validationMiddleware.js"

const router = Router()

router.use(requireClerkAuth)

// Applicant routes
router.get("/my", getMySchedules)
router.get("/application/:applicationId", getScheduleByApplicationId)

// Admin & Loan Officer route
router.get("/", requireRole("loan_officer", "admin"), getAllSchedules)

// Admin update individual installment status (paid / overdue / pending)
router.patch(
  "/:scheduleId/installments/:installmentNumber",
  requireRole("admin"),
  validateInstallmentUpdate,
  updateInstallmentStatus
)

export default router
