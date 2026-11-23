import express from "express"
import dotenv from "dotenv"
import mongoose from "mongoose"

const app = express()
const port = process.env.PORT || 3000

dotenv.config()

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Database is connected")
  })
  .catch((err) => {
    console.log(err)
  })

app.get("/", (req, res) => {
    res.send("Hello World!")
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})