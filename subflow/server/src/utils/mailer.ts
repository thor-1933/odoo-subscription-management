import nodemailer from 'nodemailer';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string, name: string): Promise<boolean> {
  const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}&email=${encodeURIComponent(toEmail)}`;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('[MAILER_ERROR] Password reset email is not configured.');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Brightloop Software <billing@brightloop.io>',
      to: toEmail,
      subject: 'Reset your SubFlow account password',
      text: `Hello ${name},\n\nYou requested a password reset. Click the following link to choose a new password:\n${resetLink}\n\nThis link is valid for 1 hour.\nIf you did not request this, please disregard this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-bottom: 16px;">Brightloop Software — SubFlow</h2>
          <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p>We received a request to reset your password. Click the button below to proceed:</p>
          <div style="margin: 24px 0;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px;">This link expires in 1 hour. If you did not request a password reset, no action is needed.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">SubFlow Recurring Revenue Engine · Brightloop Software Inc.</p>
        </div>
      `,
    });

    console.log(`[MAILER] Password reset email delivered. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[MAILER_ERROR] Password reset email delivery failed (${errorName}).`);
    return false;
  }
}
