import mongoose from "mongoose"

const auditLogSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoanApplication",
      required: [true, "Application ID is required"],
      index: true
    },
    action: {
      type: String,
      required: [true, "Action is required"],
      enum: [
        "APPLICATION_CREATED",
        "DRAFT_SAVED",
        "APPLICATION_SUBMITTED",
        "ELIGIBILITY_CHECK_RUN",
        "OFFICER_REVIEW_STARTED",
        "MORE_INFO_REQUESTED",
        "MORE_INFO_SUBMITTED",
        "RECOMMENDED_APPROVAL",
        "RECOMMENDED_REJECTION",
        "FINAL_APPROVAL",
        "FINAL_REJECTION",
        "REPAYMENT_SCHEDULE_GENERATED",
        "EMI_STATUS_UPDATED"
      ]
    },
    fromStatus: {
      type: String,
      default: ""
    },
    toStatus: {
      type: String,
      default: ""
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Performing user ID is required"],
      index: true
    },
    userRole: {
      type: String,
      enum: ["applicant", "loan_officer", "admin", "system"],
      required: true
    },
    remarks: {
      type: String,
      default: ""
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
)

// Index for chronology and queries per application
auditLogSchema.index({ applicationId: 1, createdAt: -1 })

const AuditLog = mongoose.model("AuditLog", auditLogSchema)

export default AuditLog
