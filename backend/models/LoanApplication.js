import mongoose from "mongoose"

const documentSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      enum: ["id_proof", "income_proof", "address_proof", "bank_statement", "other"],
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      default: 0
    },
    mimeType: {
      type: String,
      default: ""
    },
    publicId: {
      type: String,
      default: null
    },
    localUrl: {
      type: String,
      default: ""
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
)

const eligibilityRuleResultSchema = new mongoose.Schema(
  {
    rule: {
      type: String,
      required: true
    },
    passed: {
      type: Boolean,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    actualValue: {
      type: mongoose.Schema.Types.Mixed
    },
    threshold: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  { _id: false }
)

const loanApplicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      unique: true,
      index: true
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Applicant ID is required"],
      index: true
    },
    currentStep: {
      type: Number,
      default: 1,
      min: 1,
      max: 4
    },
    isDraft: {
      type: Boolean,
      default: true,
      index: true
    },
    status: {
      type: String,
      enum: {
        values: [
          "draft",
          "submitted",
          "under_review",
          "more_info_needed",
          "recommended_approval",
          "recommended_rejection",
          "approved",
          "rejected"
        ],
        message: "{VALUE} is not a valid application status"
      },
      default: "draft",
      index: true
    },

    // Step 1: Personal Details
    personalDetails: {
      fullName: {
        type: String,
        trim: true,
        default: ""
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: ""
      },
      dateOfBirth: {
        type: Date
      },
      panNumber: {
        type: String,
        trim: true,
        uppercase: true,
        default: ""
      },
      address: {
        street: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        postalCode: { type: String, default: "" },
        country: { type: String, default: "India" }
      },
      phone: {
        type: String,
        trim: true,
        default: ""
      }
    },

    // Step 2: Loan Details
    loanDetails: {
      loanType: {
        type: String,
        enum: ["personal", "home", "vehicle", "business"],
        default: "personal",
        index: true
      },
      amount: {
        type: Number,
        min: [0, "Amount must be a positive number"],
        default: 0
      },
      tenureMonths: {
        type: Number,
        min: [1, "Tenure must be at least 1 month"],
        default: 12
      },
      interestRate: {
        type: Number,
        min: [0, "Interest rate cannot be negative"],
        default: 12.0
      },
      purpose: {
        type: String,
        trim: true,
        default: ""
      },
      monthlyEmiPreview: {
        type: Number,
        default: 0
      }
    },

    // Step 3: Income Details
    incomeDetails: {
      monthlyIncome: {
        type: Number,
        min: [0, "Income must be a positive number"],
        default: 0
      },
      employmentType: {
        type: String,
        enum: ["salaried", "self_employed", "business_owner", "other"],
        default: "salaried"
      },
      employerName: {
        type: String,
        trim: true,
        default: ""
      },
      existingMonthlyEmi: {
        type: Number,
        default: 0,
        min: 0
      }
    },

    // Step 4: Documents Uploaded
    documents: [documentSchema],

    // Automated Rule-Based Eligibility Check Summary
    eligibilityCheck: {
      isEligible: {
        type: Boolean
      },
      checkedAt: {
        type: Date
      },
      checkedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      debtToIncomeRatio: {
        type: Number
      },
      calculatedAge: {
        type: Number
      },
      summary: {
        type: String,
        default: ""
      },
      ruleResults: [eligibilityRuleResultSchema]
    },

    // First-Level Review: Loan Officer Desk
    officerReview: {
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      reviewedAt: {
        type: Date
      },
      recommendation: {
        type: String,
        enum: ["recommended_approval", "recommended_rejection", "more_info_needed"]
      },
      remarks: {
        type: String,
        default: ""
      },
      infoRequested: {
        type: String,
        default: ""
      }
    },

    // Applicant's Response when "more_info_needed" is requested
    applicantResponse: {
      responseText: {
        type: String,
        default: ""
      },
      respondedAt: {
        type: Date
      },
      additionalDocuments: [documentSchema]
    },

    // Final Approval/Rejection: Admin Governance
    adminDecision: {
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      decidedAt: {
        type: Date
      },
      decision: {
        type: String,
        enum: ["approved", "rejected"]
      },
      remarks: {
        type: String,
        default: ""
      }
    },

    // Applicant's Reconsideration Request (Appeal when application was rejected)
    reconsiderationRequest: {
      appealStatement: {
        type: String,
        default: ""
      },
      requestedAt: {
        type: Date
      },
      adjustedAmount: {
        type: Number
      },
      adjustedTenure: {
        type: Number
      },
      additionalDocuments: [documentSchema]
    }
  },
  {
    timestamps: true
  }
)

// Auto-generate applicationNumber before validation on new records
loanApplicationSchema.pre("validate", function () {
  if (!this.applicationNumber) {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.floor(1000 + Math.random() * 9000)
    this.applicationNumber = `LMS-${timestamp}-${random}`
  }
})

// Compound indexes for fast list queries, filtering, and pagination
loanApplicationSchema.index({ status: 1, loanType: 1, createdAt: -1 })
loanApplicationSchema.index({ applicantId: 1, createdAt: -1 })

const LoanApplication = mongoose.model("LoanApplication", loanApplicationSchema)

export default LoanApplication
