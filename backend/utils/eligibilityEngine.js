import { calculateMonthlyEmi } from "./emiCalculator.js"

// Rule-Based Deterministic Credit Eligibility Evaluation Engine
export const evaluateCreditEligibility = (application) => {
  const { personalDetails, loanDetails, incomeDetails, documents } = application

  const monthlyIncome = Number(incomeDetails?.monthlyIncome) || 0
  const existingEmi = Number(incomeDetails?.existingMonthlyEmi) || 0
  const requestedAmount = Number(loanDetails?.amount) || 0
  const tenureMonths = Number(loanDetails?.tenureMonths) || 12
  const interestRate = Number(loanDetails?.interestRate) || 12
  const loanType = loanDetails?.loanType || "personal"

  const proposedEmi = calculateMonthlyEmi(requestedAmount, interestRate, tenureMonths)
  const totalMonthlyCommitment = existingEmi + proposedEmi

  // 1. Debt-to-Income (DTI) Ratio Calculation
  const debtToIncomeRatio = monthlyIncome > 0 ? (totalMonthlyCommitment / monthlyIncome) * 100 : 100

  // 2. Applicant Age Calculation
  let age = 0
  if (personalDetails?.dateOfBirth) {
    const dob = new Date(personalDetails.dateOfBirth)
    const diffMs = Date.now() - dob.getTime()
    age = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
  }

  const ruleResults = []

  // Rule 1: Age Policy (21 to 65 years old)
  const agePassed = age >= 21 && age <= 65
  ruleResults.push({
    rule: "Age Criteria",
    passed: agePassed,
    message: agePassed
      ? `Applicant age (${age} yrs) complies with acceptable age boundaries (21-65 yrs).`
      : `Applicant age (${age || "N/A"} yrs) falls outside allowable limit (21-65 yrs).`,
    actualValue: age,
    threshold: "21 - 65 yrs"
  })

  // Rule 2: Minimum Monthly Income by Loan Category
  const incomeThresholds = {
    personal: 25000,
    vehicle: 30000,
    home: 40000,
    business: 50000
  }
  const minRequiredIncome = incomeThresholds[loanType] || 25000
  const incomePassed = monthlyIncome >= minRequiredIncome
  ruleResults.push({
    rule: "Minimum Monthly Income",
    passed: incomePassed,
    message: incomePassed
      ? `Reported income (₹${monthlyIncome.toLocaleString()}) fulfills category benchmark (₹${minRequiredIncome.toLocaleString()}).`
      : `Reported income (₹${monthlyIncome.toLocaleString()}) is below required minimum (₹${minRequiredIncome.toLocaleString()}).`,
    actualValue: monthlyIncome,
    threshold: `₹${minRequiredIncome.toLocaleString()}`
  })

  // Rule 3: DTI Capacity (Must not exceed 50%)
  const maxAllowedDti = 50
  const dtiPassed = debtToIncomeRatio <= maxAllowedDti
  ruleResults.push({
    rule: "Debt-to-Income (DTI) Tolerance",
    passed: dtiPassed,
    message: dtiPassed
      ? `DTI ratio (${debtToIncomeRatio.toFixed(1)}%) is within sound risk limits (<= ${maxAllowedDti}%).`
      : `DTI ratio (${debtToIncomeRatio.toFixed(1)}%) exceeds maximum risk threshold (<= ${maxAllowedDti}%).`,
    actualValue: `${debtToIncomeRatio.toFixed(1)}%`,
    threshold: `<= ${maxAllowedDti}%`
  })

  // Rule 4: Mandatory Document Proofs
  const docTypes = (documents || []).map((d) => d.documentType)
  const hasIdProof = docTypes.includes("id_proof")
  const hasIncomeProof = docTypes.includes("income_proof")
  const docsPassed = hasIdProof && hasIncomeProof
  ruleResults.push({
    rule: "Mandatory Document Verification",
    passed: docsPassed,
    message: docsPassed
      ? "Identity proof and income proof are present and verified."
      : `Missing mandatory documents: ${!hasIdProof ? "[ID Proof] " : ""}${!hasIncomeProof ? "[Income Proof]" : ""}`.trim(),
    actualValue: docTypes,
    threshold: ["id_proof", "income_proof"]
  })

  const isEligible = ruleResults.every((r) => r.passed)
  const summary = isEligible
    ? "Applicant passes all deterministic credit policy checks."
    : `Application failed ${ruleResults.filter((r) => !r.passed).map((r) => r.rule).join(", ")}.`

  return {
    isEligible,
    debtToIncomeRatio: Math.round(debtToIncomeRatio * 10) / 10,
    calculatedAge: age,
    summary,
    ruleResults
  }
}

export default evaluateCreditEligibility
