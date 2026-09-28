import nodemailer from "nodemailer";
import logger from "../utils/logger.js";
import env from "../config/env.js";

/**
 * Base Email Provider interface
 */
export class BaseEmailProvider {
  async send(mailOptions) {
    throw new Error("Provider.send() must be implemented by subclass");
  }
}

/**
 * Real SMTP Email Provider using Nodemailer.
 * Compatible with Gmail, Brevo, SendGrid, Amazon SES, Mailgun, Outlook, or custom SMTP servers.
 */
export class SmtpEmailProvider extends BaseEmailProvider {
  constructor(options = {}) {
    super();
    this.host = options.host || env.smtpHost;
    this.port = options.port || env.smtpPort;
    this.secure = options.secure !== undefined ? options.secure : env.smtpSecure;
    this.user = (options.user || env.smtpUser || "").trim();
    // Auto-clean Gmail 16-character App Password (removes spaces and quotes)
    this.pass = (options.pass || env.smtpPass || "").replace(/["']/g, "").replace(/\s+/g, "");
    this.from = options.from || env.smtpFrom || `"MedInventory Security" <${this.user}>`;

    const transportConfig = {
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.user,
        pass: this.pass,
      },
    };

    // If using gmail host, add service shortcut for optimal TLS handling
    if (this.host.includes("gmail")) {
      transportConfig.service = "gmail";
    }

    this.transporter = nodemailer.createTransport(transportConfig);
  }

  async send(mailOptions) {
    const fromAddress = mailOptions.from || this.from;
    const info = await this.transporter.sendMail({
      from: fromAddress,
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
    });

    logger.info(`[Email Service - SMTP] Dispatched to ${mailOptions.to} (Message ID: ${info.messageId})`);
    return {
      success: true,
      delivered: true,
      provider: "smtp",
      messageId: info.messageId,
    };
  }
}

/**
 * Mock/Stub Email Provider for development, testing, and fallback.
 * Records all dispatches in memory for testing and logs structured details to console/logger.
 */
export class MockEmailProvider extends BaseEmailProvider {
  constructor() {
    super();
    this.sentEmails = [];
  }

  async send(mailOptions) {
    const timestamp = new Date().toISOString();
    const emailRecord = {
      ...mailOptions,
      timestamp,
      id: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`
    };

    this.sentEmails.push(emailRecord);

    if (env.nodeEnv !== "production") {
      logger.info(`══════════════════════════════════════════════════════════════════════════`);
      logger.info(`[Email Service - Mock Provider]`);
      logger.info(`To:        ${mailOptions.to}`);
      logger.info(`Subject:   ${mailOptions.subject}`);
      logger.info(`Timestamp: ${timestamp}`);
      if (mailOptions.metadata) {
        logger.info(`Metadata:  ${JSON.stringify(mailOptions.metadata)}`);
      }
      logger.info(`Body:\n${mailOptions.text || mailOptions.html}`);
      logger.info(`══════════════════════════════════════════════════════════════════════════`);
    } else {
      logger.warn(`[Email Service] Mock provider active in production. Email to ${mailOptions.to} (${mailOptions.subject}) not dispatched to real inbox. Configure SMTP credentials.`);
    }

    return {
      success: true,
      delivered: true,
      provider: "mock-stub",
      messageId: emailRecord.id,
      preview: mailOptions.text
    };
  }

  getHistory() {
    return [...this.sentEmails];
  }

  getLastEmail() {
    return this.sentEmails[this.sentEmails.length - 1] || null;
  }

  clearHistory() {
    this.sentEmails = [];
  }
}

/**
 * Core Reusable Email Service
 */
class EmailService {
  constructor() {
    // Automatically use SMTP if credentials are configured in environment (except in automated test suites)
    if (env.smtpUser && env.smtpPass && env.nodeEnv !== "test") {
      this.provider = new SmtpEmailProvider();
      logger.info(`[Email Service] Initialized with Live SMTP Provider (${env.smtpHost}:${env.smtpPort})`);
    } else {
      this.provider = new MockEmailProvider();
    }
  }

  /**
   * Switch or configure email provider dynamically.
   */
  setProvider(provider) {
    if (!provider || typeof provider.send !== "function") {
      throw new Error("Invalid email provider. Must implement send(mailOptions).");
    }
    this.provider = provider;
  }

  getProvider() {
    return this.provider;
  }

  /**
   * Send arbitrary email message with plain-text and rich HTML support.
   */
  async sendEmail({ to, subject, text, html, metadata = {} }) {
    if (!to) {
      throw new Error("Recipient 'to' email address is required");
    }

    return this.provider.send({
      to: to.toLowerCase().trim(),
      subject: subject || "MedInventory Notification",
      text: text || "",
      html: html || text || "",
      metadata
    });
  }

  /**
   * Send 6-digit OTP verification email for a specific purpose.
   */
  async sendOtp({ to, otp, purpose, expiryMinutes = 5, details = "" }) {
    const purposeTitles = {
      PHARMACY_REGISTRATION: "Pharmacy Registration Verification",
      STAFF_CREATE: "Staff Member Creation Authorization",
      STAFF_UPDATE: "Staff Member Update Authorization",
      STAFF_DELETE: "Staff Member Deletion Authorization",
      CHANGE_NAME: "Change Profile Name Verification",
      CHANGE_PASSWORD: "Change Password Security Verification",
      STAFF_MUTATION: "Staff Management Authorization",
      SETTINGS_UPDATE: "Account Settings Security Verification"
    };

    const title = purposeTitles[purpose] || "Action Security Verification";
    const subject = `[MedInventory] ${otp} is your verification code for ${title}`;

    const text = `Hello,

Your 6-digit verification code is:

    ======================
            ${otp}
    ======================

Purpose: ${title}
${details ? `Details: ${details}\n` : ""}
This code is valid for ${expiryMinutes} minutes. Do NOT share this code with anyone.

If you did not initiate this request, please contact your pharmacy administrator or review your account immediately.

Best regards,
MedInventory Security Team`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #2563eb; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .body { padding: 32px 28px; }
    .title { font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0; margin-bottom: 12px; }
    .otp-box { background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 8px; text-align: center; padding: 18px; margin: 24px 0; }
    .otp-code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1d4ed8; }
    .info { font-size: 14px; color: #475569; line-height: 1.6; margin: 8px 0; }
    .details { background: #f1f5f9; padding: 10px 14px; border-radius: 6px; font-size: 13px; color: #334155; margin: 12px 0; }
    .footer { border-top: 1px solid #f1f5f9; padding: 18px 28px; background: #f8fafc; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>MedInventory</h1>
    </div>
    <div class="body">
      <h2 class="title">${title}</h2>
      <p class="info">You are receiving this code to verify your action on the MedInventory platform.</p>
      
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>

      ${details ? `<div class="details"><strong>Action:</strong> ${details}</div>` : ""}

      <p class="info">⏱️ This code is valid for <strong>${expiryMinutes} minutes</strong>. Never share this code with anyone.</p>
      <p class="info" style="font-size: 13px; color: #64748b; margin-top: 20px;">If you did not request this verification code, please ignore this email or review your account security.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} MedInventory. All rights reserved.
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      metadata: {
        type: "OTP",
        otp,
        purpose,
        expiryMinutes
      }
    });
  }

  /**
   * Send onboarding credentials email to newly provisioned staff member.
   */
  async sendStaffCredentials({
    to,
    staffName,
    pharmacyName,
    email,
    temporaryPassword,
    role = "Pharmacist"
  }) {
    const subject = `[MedInventory] Welcome to ${pharmacyName || "MedInventory"} - Your Login Credentials`;

    const text = `Hello ${staffName || "Team Member"},

You have been added as a ${role} to "${pharmacyName || "our pharmacy"}" on the MedInventory platform.

Here are your temporary login credentials:
─────────────────────────────────────────────
• Pharmacy Workspace: ${pharmacyName || "Active Workspace"}
• Login Email:        ${email}
• Temporary Password: ${temporaryPassword}
• Role:               ${role}
─────────────────────────────────────────────

How to Log In:
1. Open the MedInventory portal in your browser.
2. Go to the Login page.
3. Enter your email (${email}) and temporary password.
4. Change your password in Settings after logging in.

If you have any questions, reach out to your Pharmacy Administrator.

Best regards,
MedInventory Management`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #059669; padding: 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .body { padding: 32px 28px; }
    .cred-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
    .cred-table td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
    .cred-table td:first-child { font-weight: 600; color: #475569; width: 40%; }
    .cred-table td:last-child { font-family: monospace; font-size: 14px; color: #0f172a; font-weight: 700; }
    .instructions { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .instructions ol { margin: 8px 0 0 20px; padding: 0; font-size: 13px; color: #166534; line-height: 1.6; }
    .footer { border-top: 1px solid #f1f5f9; padding: 18px 28px; background: #f8fafc; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Welcome to ${pharmacyName || "MedInventory"}</h1>
    </div>
    <div class="body">
      <p style="font-size: 15px; margin-top: 0;">Hello <strong>${staffName || "Team Member"}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.5;">You have been provisioned an employee account on the <strong>${pharmacyName || "Pharmacy Workspace"}</strong>.</p>
      
      <table class="cred-table">
        <tr>
          <td>Workspace</td>
          <td>${pharmacyName || "Active Workspace"}</td>
        </tr>
        <tr>
          <td>Assigned Role</td>
          <td>${role}</td>
        </tr>
        <tr>
          <td>Login Email</td>
          <td>${email}</td>
        </tr>
        <tr>
          <td>Temporary Password</td>
          <td style="color: #059669; font-size: 16px;">${temporaryPassword}</td>
        </tr>
      </table>

      <div class="instructions">
        <strong>Getting Started:</strong>
        <ol>
          <li>Open the MedInventory portal in your browser.</li>
          <li>Log in using your email and the temporary password above.</li>
          <li>We recommend updating your password in the <strong>Settings</strong> tab upon first login.</li>
        </ol>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} MedInventory. All rights reserved.
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail({
      to,
      subject,
      text,
      html,
      metadata: {
        type: "STAFF_CREDENTIALS",
        staffName,
        pharmacyName,
        email,
        temporaryPassword,
        role
      }
    });
  }

  // Helpers for testing/debugging
  getLastSentEmail() {
    if (typeof this.provider.getLastEmail === "function") {
      return this.provider.getLastEmail();
    }
    return null;
  }

  getSentEmails() {
    if (typeof this.provider.getHistory === "function") {
      return this.provider.getHistory();
    }
    return [];
  }

  clearSentEmails() {
    if (typeof this.provider.clearHistory === "function") {
      this.provider.clearHistory();
    }
  }
}

export const emailService = new EmailService();
export default emailService;
