import User from "../models/User.js"
import LoanApplication from "../models/LoanApplication.js"

// 1. Get All Users (Admin only, with pagination, role filter, search)
export const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10))
    const skip = (page - 1) * limit

    const { role, q, isActive, excludeAdmin } = req.query
    const filter = {}

    // Default: exclude administrators from user management list unless explicitly requested
    if (excludeAdmin === "true" || !role || role === "all") {
      filter.role = { $ne: "admin" }
    }

    if (role && ["applicant", "loan_officer"].includes(role)) {
      filter.role = role
    } else if (role === "admin") {
      filter.role = "admin"
    }

    if (typeof isActive !== "undefined") {
      filter.isActive = isActive === "true"
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: "i" } },
        { email: { $regex: q.trim(), $options: "i" } },
        { phone: { $regex: q.trim(), $options: "i" } }
      ]
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ])

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Get all users error:", error)
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch users" })
  }
}

// 2. Get User By ID (Admin only, includes summary of loan applications)
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    const applications = await LoanApplication.find({ applicantId: id })
      .select("applicationNumber status loanDetails.loanType loanDetails.amount createdAt")
      .sort({ createdAt: -1 })

    return res.status(200).json({
      success: true,
      user,
      applications
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 3. Update User Role (Disabled - Roles are permanently locked upon selection)
export const updateUserRole = async (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Roles are permanently locked upon user selection and cannot be changed by anyone, including administrators."
  })
}

// 4. Toggle User Status (Admin only, activate / deactivate)
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params

    if (req.user.id === id) {
      return res.status(400).json({ success: false, message: "You cannot change your own account status" })
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    user.isActive = !user.isActive
    if (!user.isActive) {
      // Invalidate active sessions
      user.refreshTokens = []
    }
    await user.save()

    return res.status(200).json({
      success: true,
      message: `User account has been ${user.isActive ? "activated" : "deactivated"}`,
      user
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}
