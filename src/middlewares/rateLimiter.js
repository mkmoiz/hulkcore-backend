import rateLimit from "express-rate-limit";

// Limit OTP requests to 3 requests per 5 minutes per IP address
export const otpRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 3 OTP requests per `window` (here, per 5 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    message: "Too many OTP requests from this IP. Please try again after 5 minutes.",
  },
  keyGenerator: (req) => {
    // If the app is behind a proxy (like Cloudflare or ngrok), use the forwarded IP
    return req.headers["x-forwarded-for"] || req.ip;
  }
});
