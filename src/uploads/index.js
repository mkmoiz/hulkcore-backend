import multer from "multer";
import { MAX_IMAGE_FILE_SIZE_BYTES, MAX_REPORT_FILE_SIZE_BYTES, REPORT_MIME_TYPES } from "../config/environment.js";
import { cleanText } from "../utils.js";

export const imageUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_FILE_SIZE_BYTES },
});

export const reportUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_REPORT_FILE_SIZE_BYTES },
});

export function isPdfFile(file) {
  if (!file) {
    return false;
  }

  const mimeType = cleanText(file.mimetype).toLowerCase();
  if (REPORT_MIME_TYPES.has(mimeType)) {
    return true;
  }

  const fileName = cleanText(file.originalname).toLowerCase();
  return fileName.endsWith(".pdf");
}
