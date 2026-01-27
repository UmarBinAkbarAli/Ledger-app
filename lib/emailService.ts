/**
 * Email Service
 * Handles sending emails for password resets, notifications, etc.
 * Supports multiple providers: SMTP, SendGrid, AWS SES
 */

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Initialize email transporter based on available env vars
function createTransporter() {
  // Option 1: SMTP (Gmail, custom server, etc.)
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Option 2: SendGrid
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }
  
  // Option 3: AWS SES
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    // Note: You'll need to install @aws-sdk/client-ses for this
    throw new Error('AWS SES support requires @aws-sdk/client-ses package');
  }
  
  throw new Error(
    'No email service configured. Please set SMTP_* or SENDGRID_API_KEY environment variables.'
  );
}

/**
 * Send a generic email
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@app.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    });
    
    console.log(`✅ Email sent to ${options.to}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw new Error('Failed to send email. Please contact support.');
  }
}

/**
 * Send password reset email with link
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string,
  displayName?: string
): Promise<void> {
  const appName = 'Ledger App';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0070f3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; padding: 12px 30px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${appName}</h1>
        </div>
        <div class="content">
          <h2>Set Your Password</h2>
          <p>Hello${displayName ? ' ' + displayName : ''},</p>
          <p>An administrator has created an account for you on ${appName}.</p>
          <p>Click the button below to set your password and activate your account:</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">Set Password</a>
          </p>
          <p><strong>This link expires in 1 hour.</strong></p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #0070f3;">${resetLink}</p>
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            If you didn't expect this email, please contact your administrator or ignore this message.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
          <p><a href="${appUrl}" style="color: #0070f3;">Visit ${appName}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  await sendEmail({
    to: email,
    subject: `Set Your Password - ${appName}`,
    html,
  });
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(
  email: string,
  displayName: string,
  role: string
): Promise<void> {
  const appName = 'Ledger App';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0070f3;">Welcome to ${appName}!</h1>
        <p>Hi ${displayName},</p>
        <p>Your account has been successfully created with the role: <strong>${role}</strong>.</p>
        <p>You should have received a separate email with instructions to set your password.</p>
        <p><a href="${appUrl}/login" style="display: inline-block; padding: 12px 30px; background: #0070f3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Go to Login</a></p>
        <p>If you have any questions, please contact your administrator.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #666;">© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  
  await sendEmail({
    to: email,
    subject: `Welcome to ${appName}`,
    html,
  });
}

/**
 * Send account notification email (role change, etc.)
 */
export async function sendAccountNotificationEmail(
  email: string,
  displayName: string,
  message: string,
  subject: string
): Promise<void> {
  const appName = 'Ledger App';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0070f3;">${appName}</h1>
        <p>Hi ${displayName},</p>
        <p>${message}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #666;">© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
  
  await sendEmail({
    to: email,
    subject,
    html,
  });
}
