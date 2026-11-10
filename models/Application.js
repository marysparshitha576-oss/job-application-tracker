const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  company: { type: String, required: true, trim: true, maxlength: 100 },
  jobTitle: { type: String, required: true, trim: true, maxlength: 120 },
  location: { type: String, trim: true, default: "" },
  jobLink: { type: String, trim: true, default: "" },
  salary: { type: String, trim: true, default: "" },
  status: {
    type: String,
    enum: ["Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"],
    default: "Applied"
  },
  appliedDate: { type: Date, default: Date.now },
  interviewDate: { type: Date, default: null },
  followUpDate: { type: Date, default: null },
  notes: { type: String, trim: true, default: "", maxlength: 3000 },
  resume: {
    filename: { type: String, default: "" },
    originalName: { type: String, default: "" },
    uploadedAt: { type: Date, default: null }
  }
}, { timestamps: true });

module.exports = mongoose.model("Application", applicationSchema);
