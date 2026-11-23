import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: [true, "Clerk ID is required"],
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"]
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"]
    },
    role: {
      type: String,
      enum: {
        values: ["applicant", "loan_officer", "admin"],
        message: "{VALUE} is not a supported role"
      },
      default: "applicant"
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    imageUrl: {
      type: String,
      default: ""
    },
    isActive: {
      type: Boolean,
      default: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
)

const User = mongoose.model("User", userSchema)

export default User
