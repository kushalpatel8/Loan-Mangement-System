import RepaymentSchedule from "../models/RepaymentSchedule.js"
import { logAudit } from "./auditService.js"

export const updateInstallment = async (scheduleId, installmentNumber, payload, adminUser) => {
  const { status, paymentReference, remarks } = payload

  const schedule = await RepaymentSchedule.findById(scheduleId)
  if (!schedule) {
    throw new Error("Repayment schedule not found")
  }

  const installment = schedule.installments.find(
    (inst) => inst.installmentNumber === Number(installmentNumber)
  )

  if (!installment) {
    throw new Error(`Installment #${installmentNumber} not found`)
  }

  const prevStatus = installment.status
  installment.status = status
  installment.paidDate = status === "paid" ? new Date() : null
  if (paymentReference) installment.paymentReference = paymentReference
  if (remarks) installment.remarks = remarks
  installment.markedBy = adminUser.id

  const allPaid = schedule.installments.every((inst) => inst.status === "paid")
  if (allPaid) {
    schedule.status = "closed"
  } else if (schedule.installments.some((inst) => inst.status === "overdue")) {
    schedule.status = "active"
  }

  await schedule.save()

  await logAudit({
    applicationId: schedule.applicationId,
    action: "EMI_STATUS_UPDATED",
    fromStatus: prevStatus,
    toStatus: status,
    performedBy: adminUser.id,
    userRole: adminUser.role,
    remarks: `Installment #${installmentNumber} marked as ${status}. ${remarks || ""}`.trim()
  })

  return schedule
}

export default {
  updateInstallment
}
