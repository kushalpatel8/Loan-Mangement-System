import RepaymentSchedule from "../models/RepaymentSchedule.js"
import AuditLog from "../models/AuditLog.js"

// 1. Get Repayment Schedule for a Specific Application
export const getScheduleByApplicationId = async (req, res) => {
  try {
    const { applicationId } = req.params

    const schedule = await RepaymentSchedule.findOne({ applicationId })
      .populate("applicantId", "name email phone")
      .populate("applicationId", "applicationNumber status loanDetails")

    if (!schedule) {
      return res.status(404).json({ success: false, message: "Repayment schedule not found for this loan" })
    }

    // Role check: Applicant can only view their own
    if (req.user.role === "applicant" && schedule.applicantId._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied" })
    }

    return res.status(200).json({
      success: true,
      schedule
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 2. Get All Repayment Schedules for Current Applicant
export const getMySchedules = async (req, res) => {
  try {
    const applicantId = req.user.id

    const schedules = await RepaymentSchedule.find({ applicantId })
      .populate("applicationId", "applicationNumber status loanDetails")
      .sort({ createdAt: -1 })

    return res.status(200).json({
      success: true,
      data: schedules
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 3. Get All Repayment Schedules (Admin / Loan Officer)
export const getAllSchedules = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10))
    const skip = (page - 1) * limit

    const { status, loanType } = req.query
    const filter = {}

    if (status) filter.status = status
    if (loanType) filter.loanType = loanType

    const [schedules, total] = await Promise.all([
      RepaymentSchedule.find(filter)
        .populate("applicantId", "name email phone")
        .populate("applicationId", "applicationNumber status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      RepaymentSchedule.countDocuments(filter)
    ])

    return res.status(200).json({
      success: true,
      data: schedules,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 4. Update Individual Installment Status (Bonus: Admin marks EMI as 'paid' / 'overdue')
export const updateInstallmentStatus = async (req, res) => {
  try {
    const { scheduleId, installmentNumber } = req.params
    const { status, paymentReference, remarks } = req.body

    if (!["paid", "overdue", "pending"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'paid', 'overdue', or 'pending'" })
    }

    const schedule = await RepaymentSchedule.findById(scheduleId)
    if (!schedule) {
      return res.status(404).json({ success: false, message: "Repayment schedule not found" })
    }

    const installment = schedule.installments.find(
      (inst) => inst.installmentNumber === parseInt(installmentNumber)
    )

    if (!installment) {
      return res.status(404).json({ success: false, message: `Installment #${installmentNumber} not found` })
    }

    const prevStatus = installment.status
    installment.status = status
    if (status === "paid") {
      installment.paidDate = new Date()
    } else {
      installment.paidDate = null
    }

    if (paymentReference) installment.paymentReference = paymentReference
    if (remarks) installment.remarks = remarks
    installment.markedBy = req.user.id

    // Check if all installments are paid -> close loan schedule
    const allPaid = schedule.installments.every((inst) => inst.status === "paid")
    if (allPaid) {
      schedule.status = "closed"
    } else if (schedule.installments.some((inst) => inst.status === "overdue")) {
      schedule.status = "active"
    }

    await schedule.save()

    // Audit Log
    await AuditLog.create({
      applicationId: schedule.applicationId,
      action: "EMI_STATUS_UPDATED",
      fromStatus: prevStatus,
      toStatus: status,
      performedBy: req.user.id,
      userRole: req.user.role,
      remarks: `Installment #${installmentNumber} status updated to ${status}. ${remarks || ""}`.trim(),
      metadata: { installmentNumber: parseInt(installmentNumber), paymentReference }
    })

    return res.status(200).json({
      success: true,
      message: `Installment #${installmentNumber} marked as ${status}`,
      schedule
    })
  } catch (error) {
    console.error("Update installment error:", error)
    return res.status(500).json({ success: false, message: error.message || "Failed to update installment" })
  }
}
