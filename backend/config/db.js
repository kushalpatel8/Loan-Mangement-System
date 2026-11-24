import mongoose from "mongoose"

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI is not defined in environment variables.")
    return
  }

  try {
    const conn = await mongoose.connect(uri)
    console.log(`MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`)

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB runtime connection error:", err)
    })

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting reconnection...")
    })
  } catch (error) {
    console.error(`MongoDB initial connection error: ${error.message}`)
    // Do not crash in development; allow server to boot
  }
}

export default connectDB
