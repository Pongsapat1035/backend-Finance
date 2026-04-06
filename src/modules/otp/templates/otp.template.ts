export interface OtpEmailData {
  user_name: string;
  action: string;
  otp_code: string;
  ip_address: string;
  timestamp: string;
  location: string;
  device: string;
  security_url: string;
  help_url: string;
  privacy_url: string;
  terms_url: string;
}

export function buildOtpEmailHtml(data: OtpEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>Your One-Time Password — wealthDash</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Space+Mono:wght@700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background-color: #000000; font-family: 'Inter', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #ffffff; }
    .email-wrapper { width: 100%; background-color: #000000; padding: 48px 16px; }
    .email-container { max-width: 520px; margin: 0 auto; background-color: #0a0a0a; border-radius: 12px; border: 1px solid #1c1c1c; overflow: hidden; }

    .header { padding: 32px 40px; border-bottom: 1px solid #141414; }
    .brand { display: inline-flex; align-items: center; gap: 9px; }
    .logo-mark { width: 28px; height: 28px; background: #f97316; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; }
    .brand-name { font-size: 15px; font-weight: 500; color: #ffffff; letter-spacing: -0.01em; }
    .brand-name span { color: #f97316; }

    .body { padding: 40px 40px 36px; }
    .greeting { font-size: 20px; font-weight: 500; color: #ffffff; margin-bottom: 8px; letter-spacing: -0.02em; }
    .message { font-size: 14px; line-height: 1.7; color: #555555; margin-bottom: 36px; }
    .message strong { color: #888888; font-weight: 400; }

    .otp-block { border: 1px solid #1c1c1c; border-radius: 8px; padding: 28px 24px; text-align: center; margin-bottom: 36px; }
    .otp-label { font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #333333; margin-bottom: 18px; }
    .otp-code { font-family: 'Space Mono', 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 0.3em; color: #ffffff; display: block; margin-bottom: 20px; }
    .expiry-badge { display: inline-flex; align-items: center; gap: 5px; background: #111111; border: 1px solid #1e1e1e; border-radius: 20px; padding: 5px 12px; font-size: 11px; color: #555555; }

    .info-list { list-style: none; margin-bottom: 32px; }
    .info-list li { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #111111; font-size: 13px; line-height: 1.6; color: #444444; }
    .info-list li:last-child { border-bottom: none; }
    .info-list li strong { color: #666666; font-weight: 400; }
    .dot { width: 4px; height: 4px; border-radius: 50%; background: #2a2a2a; margin-top: 7px; flex-shrink: 0; }

    .warning { border-left: 2px solid #f97316; padding: 12px 16px; }
    .warning p { font-size: 12.5px; line-height: 1.7; color: #444444; }
    .warning strong { color: #888888; font-weight: 500; }
    .warning a { color: #f97316; text-decoration: none; }

    .footer { padding: 24px 40px 32px; border-top: 1px solid #111111; }
    .footer-links { display: flex; gap: 20px; margin-bottom: 14px; }
    .footer-links a { color: #2e2e2e; text-decoration: none; font-size: 11.5px; }
    .footer-meta { font-size: 11px; color: #262626; line-height: 1.7; }
    .footer-meta a { color: #2e2e2e; text-decoration: underline; }

    @media only screen and (max-width: 600px) {
      .header, .body, .footer { padding-left: 24px; padding-right: 24px; }
      .otp-code { font-size: 28px; letter-spacing: 0.2em; }
    }
  </style>
</head>
<body>
<div class="email-wrapper">
  <table class="email-container" role="presentation" cellpadding="0" cellspacing="0" width="100%">

    <tr>
      <td class="header">
        <div class="brand">
          <div class="logo-mark">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10L5.5 6L8 8.5L12 3" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="brand-name">wealth<span>Dash</span></span>
        </div>
      </td>
    </tr>

    <tr>
      <td class="body">
        <p class="greeting">Verify it's you</p>
        <p class="message">
          Hi <strong>${data.user_name}</strong> — use the code below to <strong>${data.action}</strong>.
          Don't share it with anyone.
        </p>

        <div class="otp-block">
          <p class="otp-label">One-time password</p>
          <span class="otp-code">${data.otp_code}</span>
          <div class="expiry-badge">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="#444" stroke-width="1.4"/>
              <path d="M8 5V8.5L10 10" stroke="#444" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            Expires in 5 minutes
          </div>
        </div>

        <ul class="info-list">
          <li><span class="dot"></span><span>Valid for <strong>single use only</strong> · expires in <strong>10 minutes</strong></span></li>
          <li><span class="dot"></span><span>Date <strong>${data.timestamp}</strong></span></li>
          <li><span class="dot"></span><span>Location <strong>${data.location}</strong> · Device <strong>${data.device}</strong></span></li>
        </ul>

        <div class="warning">
          <p><strong>Didn't request this?</strong> Someone may be trying to access your account. <a href="${data.security_url}">Secure your account →</a></p>
        </div>
      </td>
    </tr>

    <tr>
      <td class="footer">
        <div class="footer-links">
          <a href="${data.help_url}">Help</a>
          <a href="${data.privacy_url}">Privacy</a>
          <a href="${data.terms_url}">Terms</a>
          <a href="${data.security_url}">Security</a>
        </div>
        <p class="footer-meta">
          wealthDash Inc. · 123 Main Street, Bangkok 10110<br/>
          Transactional email — cannot be unsubscribed.
          Questions? <a href="mailto:support@wealthdash.com">support@wealthdash.com</a>
        </p>
      </td>
    </tr>

  </table>
</div>
</body>
</html>`;
}
