import nodemailer from 'nodemailer';
import { env } from './env.js';

/** All mail goes to the local Mailpit SMTP server (http://localhost:8025). Nothing leaves the laptop.
 * SMTP_HOST defaults to 127.0.0.1: nodemailer resolves hostnames itself and can fail on "localhost". */
export const transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: false });

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Sends an email. Message bodies are never logged because they can contain reset links.
 * When Mailpit is not running the error is reported without the message content.
 */
export async function sendEmail(message: OutgoingEmail) {
  try {
    const info = await transporter.sendMail({ from: '"Brightloop Billing" <billing@brightloop.test>', ...message });
    return { delivered: true as const, messageId: info.messageId };
  } catch {
    if (env.NODE_ENV !== 'test') console.warn(`Mailpit is not reachable at ${env.SMTP_HOST}:${env.SMTP_PORT}; email "${message.subject}" was not delivered.`);
    return { delivered: false as const, messageId: null };
  }
}
