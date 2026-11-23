import { AppError } from "./errorMiddleware.js"

// Generic Schema Validator Middleware
export const validate = (validationFn) => {
  return (req, res, next) => {
    const error = validationFn(req.body)
    if (error) {
      return next(new AppError(error, 400))
    }
    next()
  }
}

// Validates Draft Application payload
export const validateDraft = (req, res, next) => {
  const { currentStep, loanDetails, incomeDetails } = req.body

  if (currentStep && (currentStep < 1 || currentStep > 4)) {
    return next(new AppError("currentStep must be between 1 and 4", 400))
  }

  if (loanDetails) {
    if (loanDetails.loanType && !["personal", "home", "vehicle", "business"].includes(loanDetails.loanType)) {
      return next(new AppError("loanType must be personal, home, vehicle, or business", 400))
    }
    if (loanDetails.amount && (isNaN(loanDetails.amount) || loanDetails.amount < 0)) {
      return next(new AppError("loan amount must be a positive number", 400))
    }
    if (loanDetails.tenureMonths && (isNaN(loanDetails.tenureMonths) || loanDetails.tenureMonths < 1)) {
      return next(new AppError("tenureMonths must be at least 1 month", 400))
    }
  }

  if (incomeDetails) {
    if (incomeDetails.monthlyIncome && (isNaN(incomeDetails.monthlyIncome) || incomeDetails.monthlyIncome < 0)) {
      return next(new AppError("monthlyIncome must be a positive number", 400))
    }
    if (incomeDetails.employmentType && !["salaried", "self_employed", "business_owner", "other"].includes(incomeDetails.employmentType)) {
      return next(new AppError("employmentType must be salaried, self_employed, business_owner, or other", 400))
    }
  }

  next()
}

// Validates Submission payload
export const validateSubmission = (req, res, next) => {
  const { id } = req.params

  if (!id) {
    return next(new AppError("Application ID parameter is required", 400))
  }

  next()
}

// Validates PAN format (Indian Income Tax Permanent Account Number: 5 letters + 4 digits + 1 letter)
export const isValidPAN = (pan) => {
  if (!pan || typeof pan !== "string") return false
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase())
}

// Validates Loan Officer Review payload
export const validateOfficerReview = (req, res, next) => {
  const { recommendation, infoRequested } = req.body

  const allowed = ["recommended_approval", "recommended_rejection", "more_info_needed"]
  if (!recommendation || !allowed.includes(recommendation)) {
    return next(new AppError(`Recommendation must be one of: ${allowed.join(", ")}`, 400))
  }

  if (recommendation === "more_info_needed" && (!infoRequested || !infoRequested.trim())) {
    return next(new AppError("infoRequested is required when requesting more info from applicant", 400))
  }

  next()
}

// Validates Admin Decision payload
export const validateAdminDecision = (req, res, next) => {
  const { decision } = req.body

  if (!decision || !["approved", "rejected"].includes(decision)) {
    return next(new AppError("decision must be either 'approved' or 'rejected'", 400))
  }

  next()
}

// Validates Installment Status Update payload
export const validateInstallmentUpdate = (req, res, next) => {
  const { status } = req.body

  if (!status || !["paid", "overdue", "pending"].includes(status)) {
    return next(new AppError("status must be 'paid', 'overdue', or 'pending'", 400))
  }

  next()
}
