import "server-only";
import mongoose, { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

/** Reuse compiled models across dev hot reloads instead of throwing OverwriteModelError. */
function model<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

// ---------- User ----------
export const ROLES = ["employee", "admin"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, enum: ROLES, default: "employee", required: true },
    isActive: { type: Boolean, default: true, required: true },
    /** Bump to sign the user out everywhere. Sessions carry the version they were issued with. */
    tokenVersion: { type: Number, default: 0, required: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = model("User", userSchema);

// ---------- One-time login codes ----------
const otpSchema = new Schema({
  email: { type: String, required: true, unique: true },
  codeHash: { type: String, required: true },
  attemptsLeft: { type: Number, required: true },
  lastSentAt: { type: Date, required: true },
  /** MongoDB deletes the document shortly after this moment (TTL index). Verify also checks it, since TTL runs once a minute. */
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});
export const Otp = model("Otp", otpSchema);

// ---------- Fixed-window rate limit counters ----------
const rateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});
export const RateLimit = model("RateLimit", rateLimitSchema);

// ---------- Settings (single document) ----------
const holidaySchema = new Schema(
  { date: { type: String, required: true }, name: { type: String, required: true, trim: true, maxlength: 80 } },
  { _id: false },
);

const settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    allowedDomains: { type: [String], default: [] },
    /** 0 = Sunday ... 6 = Saturday. Leave on these days costs nothing and missing them is not an absence. */
    weeklyOffDays: { type: [Number], default: [0] },
    holidays: { type: [holidaySchema], default: [] },
  },
  { timestamps: true },
);
export type SettingsDoc = InferSchemaType<typeof settingsSchema>;
export const Settings = model("Settings", settingsSchema);

// ---------- Leave requests ----------
export const LEAVE_TYPES = ["casual", "sick", "personal", "other"] as const;
export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export const PAY_TYPES = ["paid", "unpaid"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export type PayType = (typeof PAY_TYPES)[number];

const leaveSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    halfDay: { type: Boolean, default: false, required: true },
    /** Working days the request covers (weekly offs and holidays skipped), frozen at request time. */
    days: { type: [String], required: true },
    dayCount: { type: Number, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: LEAVE_STATUSES, default: "pending", required: true },
    /** Set by an admin on approval and editable afterwards. Null until approved. */
    payType: { type: String, enum: [...PAY_TYPES, null], default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true },
);
leaveSchema.index({ user: 1, fromDate: -1 });
leaveSchema.index({ status: 1, createdAt: -1 });
leaveSchema.index({ days: 1, status: 1 });
export type LeaveDoc = InferSchemaType<typeof leaveSchema> & { _id: Types.ObjectId; createdAt: Date };
export const Leave = model("Leave", leaveSchema);

// ---------- Attendance (one document per person per IST day) ----------
export const OVERRIDE_STATUSES = ["present", "half_day", "absent"] as const;
export type OverrideStatus = (typeof OVERRIDE_STATUSES)[number];

const attendanceSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    /** An admin's correction. When set it wins over check-ins and approved leave for that day. */
    override: { type: String, enum: [...OVERRIDE_STATUSES, null], default: null },
    overrideNote: { type: String, trim: true, maxlength: 300, default: null },
    overriddenBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
export type AttendanceDoc = InferSchemaType<typeof attendanceSchema> & { _id: Types.ObjectId };
export const Attendance = model("Attendance", attendanceSchema);
