import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

// Same SMTP setup as the dashboard backend (Utils/smtpSender.js): one transporter per instance.
const globalForMail = globalThis as unknown as { mailer?: Transporter };

function transporter(config: NonNullable<ReturnType<typeof env.smtp>>): Transporter {
  globalForMail.mailer ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  return globalForMail.mailer;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sends one email. Throws on failure; callers decide whether that matters. */
export async function sendMail(mail: Mail): Promise<void> {
  const config = env.smtp();
  if (!config) {
    if (env.isProduction()) throw new Error("SMTP_USER and SMTP_PASS are not set, so email cannot be sent");
    console.info(`[dev] email to ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  await transporter(config).sendMail({ ...mail, from: { address: config.fromEmail, name: config.fromName } });
}

export async function sendLoginCode(to: string, code: string, minutes: number): Promise<void> {
  await sendMail({
    to,
    subject: `${code} is your Flashfire Attendance Portal code`,
    text: `Your sign-in code is ${code}. It expires in ${minutes} minutes. If you did not ask for it, ignore this email.`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#0f172a">
      <p style="margin:0 0 8px;font-size:14px;color:#475569">Flashfire Attendance Portal</p>
      <p style="margin:0 0 16px;font-size:16px">Your sign-in code:</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;color:#ea580c">${code}</p>
      <p style="margin:0;font-size:13px;color:#64748b">It expires in ${minutes} minutes. If you did not ask for it, ignore this email.</p>
    </div>`,
  });
}
