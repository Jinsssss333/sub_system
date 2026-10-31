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
  try {
    const info = await transporter.sendMail({
      from: '"Brightloop Billing" <billing@brightloop.test>',
      to,
      subject,
      html,
    });

    console.log(`✉️ Email dispatched to ${to} (MessageId: ${info.messageId})`);
    return info;
  } catch (error) {
    console.warn(`⚠️ SMTP server (Mailpit) not reachable at ${env.SMTP_HOST}:${env.SMTP_PORT}. Falling back to terminal display:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📧 TO: ${to}`);
    console.log(`📌 SUBJECT: ${subject}`);
    console.log(`📄 CONTENT:\n${html}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return { messageId: 'mock-local-console-id' };
  }
}

