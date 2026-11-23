import LoanApplication from "../models/LoanApplication.js"
import AuditLog from "../models/AuditLog.js"
import RepaymentSchedule from "../models/RepaymentSchedule.js"
import { calculateEmi } from "./applicationController.js"

// Helper: Run Rule-Based Deterministic Eligibility Check
export const evaluateEligibility = (application) => {
  const { personalDetails, loanDetails, incomeDetails, documents } = application

  const monthlyIncome = Number(incomeDetails?.monthlyIncome) || 0
  const existingEmi = Number(incomeDetails?.existingMonthlyEmi) || 0
  const requestedAmount = Number(loanDetails?.amount) || 0
  const tenureMonths = Number(loanDetails?.tenureMonths) || 12
  const interestRate = Number(loanDetails?.interestRate) || 12
  const loanType = loanDetails?.loanType || "personal"

  const proposedEmi = calculateEmi(requestedAmount, interestRate, tenureMonths)
  const totalMonthlyCommitment = existingEmi + proposedEmi

  // Calculate Debt-to-Income (DTI) ratio
  const debtToIncomeRatio = monthlyIncome > 0 ? (totalMonthlyCommitment / monthlyIncome) * 100 : 100

  // Calculate Age
  let age = 0
  if (personalDetails?.dateOfBirth) {
    const dob = new Date(personalDetails.dateOfBirth)
    const diffMs = Date.now() - dob.getTime()
    age = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
  }

  const ruleResults = []

  // Rule 1: Age Requirement (21 to 65 years)
  const agePassed = age >= 21 && age <= 65
  ruleResults.push({
    rule: "Age Check",
    passed: agePassed,
    message: agePassed
      ? `Applicant age (${age} years) is within the eligible range (21-65 years).`
      : `Applicant age (${age || "N/A"} years) does not meet the 21-65 requirement.`,
    actualValue: age,
    threshold: "21 - 65 years"
  })

  // Rule 2: Minimum Income Check based on loan type
  const minIncomeThresholds = {
    personal: 25000,
    vehicle: 30000,
    home: 40000,
    business: 50000
  }
  const requiredIncome = minIncomeThresholds[loanType] || 25000
  const incomePassed = monthlyIncome >= requiredIncome
  ruleResults.push({
    rule: "Minimum Monthly Income",
    passed: incomePassed,
    message: incomePassed
      ? `Monthly income (₹${monthlyIncome.toLocaleString()}) meets the minimum threshold (₹${requiredIncome.toLocaleString()}) for ${loanType} loan.`
      : `Monthly income (₹${monthlyIncome.toLocaleString()}) is below the required ₹${requiredIncome.toLocaleString()} threshold.`,
    actualValue: monthlyIncome,
    threshold: `₹${requiredIncome.toLocaleString()}`
  })

  // Rule 3: Debt-to-Income (DTI) Ratio Check (Must not exceed 50%)
  const dtiThreshold = 50
  const dtiPassed = debtToIncomeRatio <= dtiThreshold
  ruleResults.push({
    rule: "Debt-to-Income (DTI) Ratio",
    passed: dtiPassed,
    message: dtiPassed
      ? `DTI ratio (${debtToIncomeRatio.toFixed(1)}%) is within safe credit tolerance (<= ${dtiThreshold}%).`
      : `DTI ratio (${debtToIncomeRatio.toFixed(1)}%) exceeds recommended threshold (<= ${dtiThreshold}%).`,
    actualValue: `${debtToIncomeRatio.toFixed(1)}%`,
    threshold: `<= ${dtiThreshold}%`
  })

  // Rule 4: Mandatory Documents Uploaded (ID proof & Income proof)
  const docTypes = (documents || []).map((d) => d.documentType)
  const hasIdProof = docTypes.includes("id_proof")
  const hasIncomeProof = docTypes.includes("income_proof")
  const docsPassed = hasIdProof && hasIncomeProof
  ruleResults.push({
    rule: "Mandatory Document Verification",
    passed: docsPassed,
    message: docsPassed
      ? "Both identity proof and income proof are attached."
      : `Missing required documentation: ${!hasIdProof ? "ID Proof " : ""}${!hasIncomeProof ? "Income Proof" : ""}`.trim(),
    actualValue: docTypes,
    threshold: ["id_proof", "income_proof"]
  })

  // Overall Eligibility: All core rules pass
  const isEligible = ruleResults.every((r) => r.passed)
  const summary = isEligible
    ? "Applicant passes all deterministic credit policy checks."
    : `Application flagged on ${ruleResults.filter((r) => !r.passed).map((r) => r.rule).join(", ")}.`

  return {
    isEligible,
    debtToIncomeRatio: Math.round(debtToIncomeRatio * 10) / 10,
    calculatedAge: age,
    summary,
    ruleResults
  }
}

// 1. Run Automated Eligibility Check (Loan Officer or System)
export const runEligibilityCheck = async (req, res) => {
  try {
    const { id } = req.params

    const application = await LoanApplication.findById(id)
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" })
    }

    if (application.status === "draft") {
      return res.status(400).json({ success: false, message: "Cannot run eligibility check on a draft application" })
    }

    const result = evaluateEligibility(application)

    application.eligibilityCheck = {
      ...result,
      checkedAt: new Date(),
      checkedBy: req.user.id
    }

    // Transition status to under_review if currently submitted
    const previousStatus = application.status
    if (application.status === "submitted") {
      application.status = "under_review"
    }

    await application.save()

    // Audit Log
    await AuditLog.create({
      applicationId: application._id,
      action: "ELIGIBILITY_CHECK_RUN",
      fromStatus: previousStatus,
      toStatus: application.status,
      performedBy: req.user.id,
      userRole: req.user.role,
      remarks: result.summary,
      metadata: { isEligible: result.isEligible, dti: result.debtToIncomeRatio }
    })

    return res.status(200).json({
      success: true,
      message: "Eligibility check completed",
      eligibilityCheck: application.eligibilityCheck,
      status: application.status
    })
  } catch (error) {
    console.error("Run eligibility check error:", error)
    return res.status(500).json({ success: false, message: error.message || "Eligibility check failed" })
  }
}

// 2. Loan Officer Review: Recommend Approval / Rejection or Request More Info
export const officerReview = async (req, res) => {
  try {
    const { id } = req.params
    const { recommendation, remarks, infoRequested } = req.body

    const validRecommendations = ["recommended_approval", "recommended_rejection", "more_info_needed"]
    if (!validRecommendations.includes(recommendation)) {
      return res.status(400).json({
        success: false,
        message: `Recommendation must be one of: ${validRecommendations.join(", ")}`
      })
    }

    if (recommendation === "more_info_needed" && !infoRequested) {
      return res.status(400).json({
        success: false,
        message: "Please specify the details or documents requested from the applicant in infoRequested."
      })
    }

    const application = await LoanApplication.findById(id)
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" })
    }

    if (["approved", "rejected", "draft"].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `Application in '${application.status}' state cannot be reviewed by loan officer`
      })
    }

    application.officerReview = {
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      recommendation,
      remarks: remarks || "",
      infoRequested: infoRequested || ""
    }

    const previousStatus = application.status
    // Map recommendation to status
    if (recommendation === "recommended_approval") {
      application.status = "recommended_approval"
    } else if (recommendation === "recommended_rejection") {
      application.status = "recommended_rejection"
    } else {
      application.status = "more_info_needed"
    }

    await application.save()

    // Determine audit action
    const actionMap = {
      recommended_approval: "RECOMMENDED_APPROVAL",
      recommended_rejection: "RECOMMENDED_REJECTION",
      more_info_needed: "MORE_INFO_REQUESTED"
    }

    await AuditLog.create({
      applicationId: application._id,
      action: actionMap[recommendation],
      fromStatus: previousStatus,
      toStatus: application.status,
      performedBy: req.user.id,
      userRole: req.user.role,
      remarks: remarks || infoRequested || `Officer marked application as ${recommendation}`,
      metadata: { recommendation, infoRequested }
    })

    return res.status(200).json({
      success: true,
      message: `Application review saved. Status updated to ${application.status}.`,
      application
    })
  } catch (error) {
    console.error("Officer review error:", error)
    return res.status(500).json({ success: false, message: error.message || "Officer review failed" })
  }
}

// 3. Admin Final Decision: Approve or Reject
export const adminDecision = async (req, res) => {
  try {
    const { id } = req.params
    const { decision, remarks } = req.body

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ success: false, message: "Decision must be either 'approved' or 'rejected'" })
    }

    const application = await LoanApplication.findById(id).populate("applicantId", "name email phone")
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" })
    }

    if (["approved", "rejected", "draft"].includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `Application in '${application.status}' state cannot receive final decision`
      })
    }

    application.adminDecision = {
      decidedBy: req.user.id,
      decidedAt: new Date(),
      decision,
      remarks: remarks || ""
    }

    const previousStatus = application.status
    application.status = decision
    await application.save()

    let repaymentSchedule = null

    // If approved, automatically generate the EMI repayment amortization schedule
    if (decision === "approved") {
      const P = application.loanDetails.amount
      const annualRate = application.loanDetails.interestRate
      const tenure = application.loanDetails.tenureMonths
      const r = annualRate / 12 / 100
      const emi = calculateEmi(P, annualRate, tenure)

      let balance = P
      const installments = []
      const today = new Date()

      for (let i = 1; i <= tenure; i++) {
        const dueDate = new Date(today)
        dueDate.setMonth(today.getMonth() + i)

        const interest = Math.round(balance * r)
        let principal = emi - interest

        // Adjust final month rounding
        if (i === tenure || principal > balance) {
          principal = balance
        }
        balance = Math.max(0, balance - principal)

        installments.push({
          installmentNumber: i,
          dueDate,
          emiAmount: principal + interest,
          principalComponent: principal,
          interestComponent: interest,
          remainingPrincipal: balance,
          status: "pending"
        })
      }

      const totalInterest = installments.reduce((acc, curr) => acc + curr.interestComponent, 0)
      const totalAmountPayable = P + totalInterest

      repaymentSchedule = await RepaymentSchedule.findOneAndUpdate(
        { applicationId: application._id },
        {
          applicationId: application._id,
          applicantId: application.applicantId._id,
          loanType: application.loanDetails.loanType,
          totalPrincipal: P,
          annualInterestRate: annualRate,
          tenureMonths: tenure,
          monthlyEmi: emi,
          totalInterest,
          totalAmountPayable,
          startDate: new Date(),
          status: "active",
          installments
        },
        { upsert: true, new: true }
      )

      // Audit Log for schedule generation
      await AuditLog.create({
        applicationId: application._id,
        action: "REPAYMENT_SCHEDULE_GENERATED",
        fromStatus: "approved",
        toStatus: "approved",
        performedBy: req.user.id,
        userRole: "admin",
        remarks: `Generated ${tenure} month repayment schedule with monthly EMI of ₹${emi.toLocaleString()}`,
        metadata: { scheduleId: repaymentSchedule._id, monthlyEmi: emi, totalAmountPayable }
      })
    }

    // Audit log for Final Decision
    await AuditLog.create({
      applicationId: application._id,
      action: decision === "approved" ? "FINAL_APPROVAL" : "FINAL_REJECTION",
      fromStatus: previousStatus,
      toStatus: decision,
      performedBy: req.user.id,
      userRole: "admin",
      remarks: remarks || `Admin marked application as ${decision}`
    })

    return res.status(200).json({
      success: true,
      message: `Application successfully marked as ${decision}`,
      application,
      repaymentSchedule
    })
  } catch (error) {
    console.error("Admin decision error:", error)
    return res.status(500).json({ success: false, message: error.message || "Admin decision failed" })
  }
}
