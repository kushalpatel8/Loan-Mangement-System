import LoanApplication from "../models/LoanApplication.js"
import { evaluateCreditEligibility } from "../utils/eligibilityEngine.js"
import { generateAmortizationSchedule } from "../utils/emiCalculator.js"
import RepaymentSchedule from "../models/RepaymentSchedule.js"
import { logAudit } from "./auditService.js"
import { notifyStatusChange, notifyMoreInfoRequested } from "./notificationService.js"

export const executeEligibilityCheck = async (applicationId, officerId, officerRole) => {
  const application = await LoanApplication.findById(applicationId)
  if (!application) {
    throw new Error("Application not found")
  }
  if (application.status === "draft") {
    throw new Error("Cannot run eligibility check on a draft application")
  }

  const result = evaluateCreditEligibility(application)

  application.eligibilityCheck = {
    ...result,
    checkedAt: new Date(),
    checkedBy: officerId
  }

  const previousStatus = application.status
  if (application.status === "submitted") {
    application.status = "under_review"
  }

  await application.save()

  await logAudit({
    applicationId: application._id,
    action: "ELIGIBILITY_CHECK_RUN",
    fromStatus: previousStatus,
    toStatus: application.status,
    performedBy: officerId,
    userRole: officerRole,
    remarks: result.summary,
    metadata: { isEligible: result.isEligible, dti: result.debtToIncomeRatio }
  })

  return application
}

export const processOfficerReview = async (applicationId, officerUser, payload) => {
  const { recommendation, remarks, infoRequested } = payload

  const application = await LoanApplication.findById(applicationId).populate("applicantId", "name email phone")
  if (!application) {
    throw new Error("Application not found")
  }

  if (["approved", "rejected", "draft"].includes(application.status)) {
    throw new Error(`Application in '${application.status}' state cannot be reviewed`)
  }

  application.officerReview = {
    reviewedBy: officerUser.id,
    reviewedAt: new Date(),
    recommendation,
    remarks: remarks || "",
    infoRequested: infoRequested || ""
  }

  const previousStatus = application.status
  application.status = recommendation

  await application.save()

  const actionMap = {
    recommended_approval: "RECOMMENDED_APPROVAL",
    recommended_rejection: "RECOMMENDED_REJECTION",
    more_info_needed: "MORE_INFO_REQUESTED"
  }

  await logAudit({
    applicationId: application._id,
    action: actionMap[recommendation],
    fromStatus: previousStatus,
    toStatus: application.status,
    performedBy: officerUser.id,
    userRole: "loan_officer",
    remarks: remarks || infoRequested || `Officer recommended: ${recommendation}`
  })

  if (recommendation === "more_info_needed") {
    await notifyMoreInfoRequested({
      user: application.applicantId,
      application,
      infoRequested
    })
  }

  return application
}

export const processAdminDecision = async (applicationId, adminUser, payload) => {
  const { decision, remarks } = payload

  const application = await LoanApplication.findById(applicationId).populate("applicantId", "name email phone")
  if (!application) {
    throw new Error("Application not found")
  }

  if (["approved", "rejected", "draft"].includes(application.status)) {
    throw new Error(`Application in '${application.status}' state cannot receive final decision`)
  }

  application.adminDecision = {
    decidedBy: adminUser.id,
    decidedAt: new Date(),
    decision,
    remarks: remarks || ""
  }

  const previousStatus = application.status
  application.status = decision
  await application.save()

  let repaymentSchedule = null

  if (decision === "approved") {
    const P = application.loanDetails.amount
    const annualRate = application.loanDetails.interestRate
    const tenure = application.loanDetails.tenureMonths

    const amortization = generateAmortizationSchedule(P, annualRate, tenure, new Date())

    repaymentSchedule = await RepaymentSchedule.findOneAndUpdate(
      { applicationId: application._id },
      {
        applicationId: application._id,
        applicantId: application.applicantId._id,
        loanType: application.loanDetails.loanType,
        totalPrincipal: P,
        annualInterestRate: annualRate,
        tenureMonths: tenure,
        monthlyEmi: amortization.monthlyEmi,
        totalInterest: amortization.totalInterest,
        totalAmountPayable: amortization.totalAmountPayable,
        startDate: new Date(),
        status: "active",
        installments: amortization.installments
      },
      { upsert: true, new: true }
    )

    await logAudit({
      applicationId: application._id,
      action: "REPAYMENT_SCHEDULE_GENERATED",
      fromStatus: "approved",
      toStatus: "approved",
      performedBy: adminUser.id,
      userRole: "admin",
      remarks: `Repayment schedule auto-generated: ₹${amortization.monthlyEmi.toLocaleString()}/mo over ${tenure} months`
    })
  }

  await logAudit({
    applicationId: application._id,
    action: decision === "approved" ? "FINAL_APPROVAL" : "FINAL_REJECTION",
    fromStatus: previousStatus,
    toStatus: decision,
    performedBy: adminUser.id,
    userRole: "admin",
    remarks: remarks || `Admin marked application as ${decision}`
  })

  await notifyStatusChange({
    user: application.applicantId,
    application,
    previousStatus,
    newStatus: decision,
    remarks
  })

  return { application, repaymentSchedule }
}

export default {
  executeEligibilityCheck,
  processOfficerReview,
  processAdminDecision
}
