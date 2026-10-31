import nodemailer from 'nodemailer';
import { env } from './env.js';

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
});

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const info = await transporter.sendMail({
    from: '"Brightloop Billing" <billing@brightloop.test>',
    to,
    subject,
    html,
  });

  console.log(`✉️ Email dispatched to ${to} (MessageId: ${info.messageId})`);
  return info;
}

