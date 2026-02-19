/**
 * Edge-compatible email service using Resend
 * Replaces nodemailer for Edge Runtime compatibility
 */

import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

// Initialize Resend client
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY tidak dikonfigurasi di environment variable');
  }
  return new Resend(apiKey);
}

// Get email configuration from database (for from name/email)
export async function getEmailConfig() {
  const config = await prisma.smtpConfig.findFirst({
    where: { isActive: true },
  });

  return {
    fromName: config?.fromName || process.env.EMAIL_FROM_NAME || 'E-Learning Platform',
    fromEmail: config?.fromEmail || process.env.EMAIL_FROM || 'noreply@resend.dev',
  };
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const resend = getResendClient();
  const config = await getEmailConfig();

  const recipients = Array.isArray(to) ? to : [to];

  const result = await resend.emails.send({
    from: `${config.fromName} <${config.fromEmail}>`,
    to: recipients,
    subject,
    html,
  });

  if (result.error) {
    throw new Error(`Failed to send email: ${result.error.message}`);
  }

  return result.data;
}
