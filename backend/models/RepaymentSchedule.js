import mongoose from "mongoose"

const installmentSchema = new mongoose.Schema(
  {
    installmentNumber: {
      type: Number,
      required: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    emiAmount: {
      type: Number,
      required: true
    },
    principalComponent: {
      type: Number,
      required: true
    },
    interestComponent: {
      type: Number,
      required: true
    },
    remainingPrincipal: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "paid", "overdue"],
      default: "pending",
      index: true
    },
    paidDate: {
      type: Date
    },
    paymentReference: {
      type: String,
      trim: true,
      default: ""
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    remarks: {
      type: String,
      default: ""
    }
  },
  { _id: true }
)

const repaymentScheduleSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LoanApplication",
      required: [true, "Application ID is required"],
      unique: true,
      index: true
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Applicant ID is required"],
      index: true
    },
    loanType: {
      type: String,
      enum: ["personal", "home", "vehicle", "business"],
      required: true
    },
    totalPrincipal: {
      type: Number,
      required: true
    },
    annualInterestRate: {
      type: Number,
      required: true
    },
    tenureMonths: {
      type: Number,
      required: true
    },
    monthlyEmi: {
      type: Number,
      required: true
    },
    totalInterest: {
      type: Number,
      required: true
    },
    totalAmountPayable: {
      type: Number,
      required: true
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ["active", "closed", "defaulted"],
      default: "active",
      index: true
    },
    installments: [installmentSchema]
  },
  {
    timestamps: true
  }
)

repaymentScheduleSchema.index({ applicantId: 1, status: 1 })

const RepaymentSchedule = mongoose.model("RepaymentSchedule", repaymentScheduleSchema)

export default RepaymentSchedule
