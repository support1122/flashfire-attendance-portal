import "server-only";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/** Read lazily so `next build` works without secrets; the first request fails loudly instead. */
export const env = {
  mongoUri: () => required("MONGODB_URI"),
  /** Own database on the shared cluster, so this app never touches another app's collections. */
  mongoDb: () => process.env.MONGODB_DB?.trim() || "flashfire_attendance",
  adminEmails: () => list("ADMIN_EMAILS"),
  defaultAllowedDomains: () => list("DEFAULT_ALLOWED_DOMAINS"),
  /** The one account that can also sign in with a password. Both must be set to enable it. */
  defaultAdmin: () => {
    const email = process.env.DEFAULT_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.DEFAULT_ADMIN_PASSWORD;
    return email && password ? { email, password } : null;
  },
  /** Every email that is always an admin: ADMIN_EMAILS plus the default admin. */
  lockedAdminEmails: () => {
    const admin = env.defaultAdmin();
    return admin ? [...list("ADMIN_EMAILS"), admin.email] : list("ADMIN_EMAILS");
  },
  smtp: () => {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (!user || !pass) return null;
    const port = Number(process.env.SMTP_PORT) || 465;
    return {
      host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE.trim().toLowerCase() === "true" : port === 465,
      user,
      pass,
      fromEmail: process.env.SMTP_FROM_EMAIL?.trim() || user,
      fromName: process.env.SMTP_FROM_NAME?.trim() || "Flashfire Attendance",
    };
  },
  isProduction: () => process.env.NODE_ENV === "production",
};
