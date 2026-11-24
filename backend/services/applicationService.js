import LoanApplication from "../models/LoanApplication.js"
import { calculateMonthlyEmi } from "../utils/emiCalculator.js"
import { logAudit } from "./auditService.js"

export const saveOrUpdateDraft = async (applicantId, payload) => {
  const { applicationId, currentStep, personalDetails, loanDetails, incomeDetails, documents } = payload

  let application

  if (applicationId) {
    application = await LoanApplication.findOne({ _id: applicationId, applicantId })
    if (!application) {
      throw new Error("Draft application not found")
    }
    if (application.status !== "draft") {
      throw new Error("Cannot modify an application that is already submitted")
    }
  } else {
    application = new LoanApplication({
      applicantId,
      isDraft: true,
      status: "draft"
    })
  }

  if (currentStep) application.currentStep = currentStep
  if (personalDetails) application.personalDetails = { ...application.personalDetails?.toObject?.() || {}, ...personalDetails }
  if (incomeDetails) application.incomeDetails = { ...application.incomeDetails?.toObject?.() || {}, ...incomeDetails }
  if (documents) application.documents = documents

  if (loanDetails) {
    application.loanDetails = { ...application.loanDetails?.toObject?.() || {}, ...loanDetails }
    application.loanDetails.monthlyEmiPreview = calculateMonthlyEmi(
      application.loanDetails.amount,
      application.loanDetails.interestRate,
      application.loanDetails.tenureMonths
    )
  }

  await application.save()

  await logAudit({
    applicationId: application._id,
    action: applicationId ? "DRAFT_SAVED" : "APPLICATION_CREATED",
    fromStatus: "draft",
    toStatus: "draft",
    performedBy: applicantId,
    userRole: "applicant",
    remarks: `Application draft saved at Step ${application.currentStep}`
  })

  return application
}

export default {
  saveOrUpdateDraft
}
