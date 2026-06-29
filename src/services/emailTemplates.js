// ─── Email Templates ─────────────────────────────────────────────
//
// All transactional email templates live here.
// Each template exports an HTML builder and a plain-text fallback.

/**
 * Build the HTML body for an OTP verification email.
 * @param {string} otpCode — The 6-digit OTP code
 * @returns {string} Full HTML document string
 */
export function buildOtpEmailHtml(otpCode) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>Your Hulk Core Verification Code</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#08080c;font-family:'Arial','Helvetica Neue',Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08080c;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <!-- Header -->
          <tr>
            <td align="center" style="border-top:4px solid #39FF14;padding:30px 0 10px;">
              <h1 style="margin:0;color:#ffffff;text-transform:uppercase;letter-spacing:2px;font-size:28px;font-weight:900;">
                HULK<span style="color:#39FF14;">CORE</span>
              </h1>
            </td>
          </tr>

          <!-- Body Card -->
          <tr>
            <td style="padding:0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#121217;border:1px solid #2a2a35;border-radius:12px;box-shadow:0 0 20px rgba(57,255,20,0.15);">
                <tr>
                  <td style="padding:36px 30px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:16px;color:#a1a1aa;">
                      Your secure verification code is:
                    </p>
                    <div style="font-size:38px;font-weight:900;color:#39FF14;letter-spacing:8px;margin:24px 0;line-height:1.2;">
                      ${otpCode}
                    </div>
                    <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
                      This code will expire in 5 minutes.<br />
                      Do not share this code with anyone.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:30px 0 0;border-bottom:4px solid #39FF14;">
              <p style="margin:0;font-size:11px;color:#52525b;padding-bottom:20px;">
                &copy; Hulk Core Supplements. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build the plain-text body for an OTP verification email.
 * Used as a fallback for email clients that don't render HTML.
 * @param {string} otpCode — The 6-digit OTP code
 * @returns {string} Plain-text email body
 */
export function buildOtpEmailText(otpCode) {
  return [
    "HULK CORE — Verification Code",
    "",
    `Your secure verification code is: ${otpCode}`,
    "",
    "This code will expire in 5 minutes.",
    "Do not share this code with anyone.",
    "",
    "© Hulk Core Supplements. All rights reserved.",
  ].join("\n");
}
