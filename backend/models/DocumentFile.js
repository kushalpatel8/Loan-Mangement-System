import mongoose from "mongoose"

const documentFileSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    documentType: {
      type: String,
      enum: ["id_proof", "income_proof", "address_proof", "bank_statement", "other"],
      default: "other"
    },
    mimeType: {
      type: String,
      default: "application/pdf"
    },
    fileSize: {
      type: Number,
      default: 0
    },
    data: {
      type: Buffer,
      required: true
    },
    uploadedBy: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
)

const DocumentFile = mongoose.model("DocumentFile", documentFileSchema)

export default DocumentFile
