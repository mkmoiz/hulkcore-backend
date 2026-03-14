import { MAX_IMAGE_FILE_SIZE_BYTES, MAX_REPORT_FILE_SIZE_BYTES } from "../config/environment.js";
import { cleanText } from "../utils.js";

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function createErrorBody(code, message, details) {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

export function apiErrorHandler(error, req, res, _next) {
  console.error(error);

  if (error?.code === "LIMIT_FILE_SIZE") {
    const uploadField = cleanText(error?.field).toLowerCase();
    const requestPath = cleanText(req?.originalUrl || req?.path).toLowerCase();
    const isReportUpload = uploadField === "report" || requestPath.includes("/lab-reports/upload");
    const maxSizeMb = Math.floor((isReportUpload ? MAX_REPORT_FILE_SIZE_BYTES : MAX_IMAGE_FILE_SIZE_BYTES) / (1024 * 1024));
    const fileLabel = isReportUpload ? "Report PDF file" : "Image file";

    return res.status(400).json({
      message: `${fileLabel} is too large. Maximum size is ${maxSizeMb}MB.`,
    });
  }

  if (typeof error?.message === "string" && error.message.includes("Cloudflare R2 is not configured")) {
    return res.status(503).json({ message: error.message });
  }

  if (error?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Duplicate value conflict." });
  }

  if (error?.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({ message: "Referenced category does not exist." });
  }

  if (error?.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(409).json({ message: "Category is linked to existing products." });
  }

  if (typeof error?.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600) {
    return res.status(error.statusCode).json({ message: error.message || "Request failed." });
  }

  res.status(500).json({
    message: "Unexpected server error.",
  });
}
