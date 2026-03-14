import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.post("/api/images", imageUploadMiddleware.single("image"), async (req, res, next) => {
  try {
    if (!isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required. Use form field name 'image'." });
    }

    if (!req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({ message: "Only image files are allowed." });
    }

    const uploadedImage = await uploadImageToR2({
      fileBuffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalFileName: req.file.originalname,
    });

    return res.status(201).json(uploadedImage);
  } catch (error) {
    next(error);
  }
});

app.post(
  ["/api/admin/lab-reports/upload", "/admin/lab-reports/upload"],
  requireAdminAccess,
  reportUploadMiddleware.single("report"),
  async (req, res, next) => {
    try {
      if (!isR2Configured()) {
        return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "PDF file is required. Use form field name 'report'." });
      }

      if (!isPdfFile(req.file)) {
        return res.status(400).json({ message: "Only PDF files are allowed." });
      }

      const uploadedReport = await uploadImageToR2({
        fileBuffer: req.file.buffer,
        contentType: req.file.mimetype || "application/pdf",
        originalFileName: req.file.originalname || "lab-report.pdf",
        keyPrefix: REPORT_UPLOAD_PREFIX,
      });

      return res.status(201).json({
        reportUrl: uploadedReport.imageUrl,
        reportKey: uploadedReport.imageKey,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.delete("/api/images", async (req, res, next) => {
  try {
    const keyParam = Array.isArray(req.query?.key) ? req.query.key[0] : req.query?.key;
    const imageKey = cleanText(keyParam);

    if (!imageKey) {
      return res.status(400).json({ message: "Image key is required." });
    }

    if (!isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    await deleteImageFromR2ByKey(imageKey);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});



export default app;
