import User from "../models/User.js"

// 1. Sync User from Clerk (Called when client logs in or loads with Clerk session)
export const syncUser = async (req, res) => {
  try {
    const { clerkId, email, name, imageUrl, phone, role } = req.body

    const targetClerkId = clerkId || req.auth?.userId

    if (!targetClerkId || !email) {
      return res.status(400).json({
        success: false,
        message: "clerkId (or authenticated Clerk session) and email are required"
      })
    }

    let user = await User.findOne({
      $or: [{ clerkId: targetClerkId }, { email: email.toLowerCase().trim() }]
    })

    if (user) {
      // Update existing record
      user.clerkId = targetClerkId
      if (name) user.name = name.trim()
      if (imageUrl) user.imageUrl = imageUrl
      if (phone) user.phone = phone.trim()
      await user.save()
    } else {
      // Create new user profile linked to Clerk
      const validRole = ["applicant", "loan_officer", "admin"].includes(role)
      const assignedRole = validRole ? role : "applicant"
      user = new User({
        clerkId: targetClerkId,
        email: email.toLowerCase().trim(),
        name: name ? name.trim() : email.split("@")[0],
        role: assignedRole,
        roleSelected: validRole ? true : false,
        imageUrl: imageUrl || "",
        phone: phone ? phone.trim() : ""
      })
      await user.save()
    }

    return res.status(200).json({
      success: true,
      message: "User synchronized successfully with Clerk",
      user
    })
  } catch (error) {
    console.error("Clerk sync error:", error)
    return res.status(500).json({ success: false, message: error.message || "Failed to sync user" })
  }
}

// 2. Get Current Authenticated User (Using Clerk auth middleware)
export const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not authenticated" })
    }

    return res.status(200).json({
      success: true,
      user: req.user
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 3. Update User Profile (Phone, display name)
export const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body
    const user = req.user

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" })
    }

    if (name) user.name = name.trim()
    if (typeof phone !== "undefined") user.phone = phone.trim()
    await user.save()

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

// 4. Select Role (One-time, permanent role selection after signup)
export const selectRole = async (req, res) => {
  try {
    const { role, adminToken } = req.body
    let user = req.user

    // If req.user is not yet populated by Clerk auth, find by req.auth.userId or clerkId from body
    if (!user && (req.auth?.userId || req.body.clerkId)) {
      const clerkId = req.auth?.userId || req.body.clerkId
      user = await User.findOne({ clerkId })
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found. Please sync user first." })
    }

    // Role immutability check
    if (user.roleSelected) {
      return res.status(400).json({
        success: false,
        message: "Your role is already permanently locked and cannot be changed.",
        user
      })
    }

    if (!["applicant", "loan_officer", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role selected. Must be 'applicant', 'loan_officer', or 'admin'."
      })
    }

    // If attempting to claim 'admin' role, verify secret admin token
    if (role === "admin") {
      const expectedToken = process.env.ADMIN_TOKEN || "12345"
      if (!adminToken || String(adminToken).trim() !== String(expectedToken).trim()) {
        return res.status(403).json({
          success: false,
          message: "Invalid Admin Passkey / Token. Verification failed."
        })
      }
    }

    user.role = role
    user.roleSelected = true
    await user.save()

    return res.status(200).json({
      success: true,
      message: `Role permanently set to ${role}.`,
      user
    })
  } catch (error) {
    console.error("Select role error:", error)
    return res.status(500).json({ success: false, message: error.message || "Failed to set role" })
  }
}

// 5. Handle Clerk Webhook Events (user.created, user.updated, user.deleted)
export const handleClerkWebhook = async (req, res) => {
  try {
    const { type, data } = req.body

    if (!type || !data) {
      return res.status(400).json({ success: false, message: "Invalid webhook payload" })
    }

    const clerkId = data.id
    const primaryEmailObj = data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
    const email = primaryEmailObj?.email_address || data.email_addresses?.[0]?.email_address
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || "User"
    const imageUrl = data.image_url || ""

    if (type === "user.created" || type === "user.updated") {
      let user = await User.findOne({ clerkId })

      if (user) {
        if (email) user.email = email.toLowerCase()
        user.name = name
        user.imageUrl = imageUrl
        await user.save()
      } else if (email) {
        user = new User({
          clerkId,
          email: email.toLowerCase(),
          name,
          imageUrl,
          role: "applicant"
        })
        await user.save()
      }
    } else if (type === "user.deleted") {
      await User.findOneAndUpdate({ clerkId }, { isActive: false })
    }

    return res.status(200).json({ success: true, message: "Webhook processed" })
  } catch (error) {
    console.error("Clerk webhook error:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}
