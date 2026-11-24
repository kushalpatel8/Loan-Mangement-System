import AuditLog from "../models/AuditLog.js"

export const logAudit = async ({
  applicationId,
  action,
  fromStatus = "",
  toStatus = "",
  performedBy,
  userRole = "system",
  remarks = "",
  metadata = {}
}) => {
  try {
    const entry = await AuditLog.create({
      applicationId,
      action,
      fromStatus,
      toStatus,
      performedBy,
      userRole,
      remarks,
      metadata
    })
    return entry
  } catch (error) {
    console.error("Failed to write audit log entry:", error.message)
    return null
  }
}

export const getApplicationTimeline = async (applicationId) => {
  return AuditLog.find({ applicationId })
    .populate("performedBy", "name email role")
    .sort({ createdAt: 1 })
}

export default {
  logAudit,
  getApplicationTimeline
}
