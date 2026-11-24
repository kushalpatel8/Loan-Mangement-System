import { Router } from "express"
import {
  runEligibilityCheck,
  officerReview,
  adminDecision
} from "../controllers/reviewController.js"
import { getApplicationTimeline } from "../services/auditService.js"
import { requireClerkAuth, requireRole } from "../middleware/authMiddleware.js"
import { validateOfficerReview, validateAdminDecision } from "../middleware/validationMiddleware.js"

const router = Router()

router.use(requireClerkAuth)

// Run deterministic eligibility check (Officer or Admin)
router.post("/:id/eligibility", requireRole("loan_officer", "admin", "officer", "applicant"), runEligibilityCheck)

// Loan Officer Review (Recommend approve / reject / request more info)
router.post("/:id/officer-review", requireRole("loan_officer", "admin", "officer", "applicant"), validateOfficerReview, officerReview)

// Admin Final Decision (Final Approve / Reject)
router.post("/:id/admin-decision", requireRole("admin", "loan_officer", "officer", "applicant"), validateAdminDecision, adminDecision)

// Chronological audit trail for an application
router.get("/:id/audit-trail", async (req, res, next) => {
  try {
    const timeline = await getApplicationTimeline(req.params.id)
    return res.status(200).json({
      success: true,
      data: timeline
    })
  } catch (error) {
    next(error)
  }
})

export default router
