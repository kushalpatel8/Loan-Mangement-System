import mongoose from "mongoose"

export const connectDB = async () => {
  // If already connected or connecting, reuse the connection in serverless environment
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI is not defined in environment variables.")
    return
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    })
    console.log(`MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`)

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB runtime connection error:", err)
    })

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting reconnection...")
    })

    return conn
  } catch (error) {
    console.error(`MongoDB initial connection error: ${error.message}`)
    // Do not crash in development/serverless cold-start
  }
}

export default connectDB
