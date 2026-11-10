const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Application = require("./models/Application");

const app = express();
const PORT = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Store resumes outside the public folder. Download them through the API route below.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeOriginal}`);
  }
});

const allowedExtensions = new Set([".pdf", ".doc", ".docx"]);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return cb(new Error("Resume must be a PDF, DOC, or DOCX file."));
    }
    cb(null, true);
  }
});

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

// List applications, newest first. Optional status and search filters.
app.get("/api/applications", asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== "All") filter.status = req.query.status;
  if (req.query.search) {
    const search = req.query.search.trim();
    filter.$or = [
      { company: { $regex: search, $options: "i" } },
      { jobTitle: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } }
    ];
  }
  const applications = await Application.find(filter).sort({ createdAt: -1 });
  res.json(applications);
}));

app.get("/api/applications/:id", asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application) return res.status(404).json({ message: "Application not found." });
  res.json(application);
}));

app.post("/api/applications", asyncHandler(async (req, res) => {
  const application = await Application.create(req.body);
  res.status(201).json(application);
}));

app.put("/api/applications/:id", asyncHandler(async (req, res) => {
  const application = await Application.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  if (!application) return res.status(404).json({ message: "Application not found." });
  res.json(application);
}));

app.delete("/api/applications/:id", asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application) return res.status(404).json({ message: "Application not found." });

  if (application.resume && application.resume.filename) {
    const resumePath = path.join(uploadDir, path.basename(application.resume.filename));
    if (fs.existsSync(resumePath)) fs.unlinkSync(resumePath);
  }

  await application.deleteOne();
  res.json({ message: "Application deleted." });
}));

app.post("/api/applications/:id/resume", upload.single("resume"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Choose a resume file first." });

  const application = await Application.findById(req.params.id);
  if (!application) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: "Application not found." });
  }

  // Remove the previous resume file when replacing it.
  if (application.resume && application.resume.filename) {
    const oldPath = path.join(uploadDir, path.basename(application.resume.filename));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  application.resume = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    uploadedAt: new Date()
  };
  await application.save();
  res.json(application);
}));

app.get("/api/applications/:id/resume", asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application || !application.resume || !application.resume.filename) {
    return res.status(404).json({ message: "No resume found for this application." });
  }

  const filename = path.basename(application.resume.filename);
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Resume file is missing from storage." });
  res.download(filePath, application.resume.originalName || filename);
}));

// Friendly upload errors and general API errors.
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "Resume must be 5 MB or smaller." : err.message });
  }
  res.status(err.status || 500).json({ message: err.message || "Something went wrong." });
});

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/job_tracker");
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Job Tracker running at http://localhost:${PORT}`));
  } catch (error) {
    console.error("Could not connect to MongoDB.");
    console.error("Check MONGODB_URI in your .env file and make sure MongoDB is running.");
    console.error(error.message);
    process.exit(1);
  }
}

start();
