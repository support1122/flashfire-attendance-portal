import "server-only";
import mongoose from "mongoose";

/**
 * Keeps admins in line with the CRM: someone who is an active CRM admin (role "admin" or isAdmin)
 * becomes an admin here when they sign in. Read-only, and only runs when CRM_DB_NAME names the
 * CRM's database on the same cluster (the website backend uses "test").
 * Promote-only on purpose: removing CRM admin does not demote someone an admin promoted in this app.
 */
export async function isCrmAdmin(email: string): Promise<boolean> {
  const dbName = process.env.CRM_DB_NAME?.trim();
  if (!dbName) return false;
  try {
    const row = await mongoose.connection
      .useDb(dbName, { useCache: true })
      .collection("crmusers")
      .findOne({ email }, { projection: { role: 1, isAdmin: 1, isActive: 1 } });
    return Boolean(row && row.isActive !== false && (row.role === "admin" || row.isAdmin === true));
  } catch (error) {
    // The CRM lookup is a convenience; sign-in must not fail because of it.
    console.error("[crm-admins] lookup failed", error);
    return false;
  }
}
