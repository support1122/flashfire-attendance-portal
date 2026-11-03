/**
 * API contract shared by route handlers and the UI. Dates are ISO strings, days are IST "YYYY-MM-DD".
 * Every error response is { error: string, details?: unknown } with a matching HTTP status.
 */
import type { DayStatus, MonthSummary } from "./rules";

export type { DayStatus, MonthSummary };

export type Role = "employee" | "admin";
export type LeaveType = "casual" | "sick" | "personal" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type PayType = "paid" | "unpaid";
export type OverrideStatus = "present" | "half_day" | "absent";

export interface AppSettings {
  allowedDomains: string[];
  /** 0 = Sunday ... 6 = Saturday */
  weeklyOffDays: number[];
  holidays: { date: string; name: string }[];
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

export interface MeResponse {
  user: PublicUser;
}

export interface LeaveView {
  id: string;
  user: { id: string; name: string; email: string };
  type: LeaveType;
  fromDate: string;
  toDate: string;
  halfDay: boolean;
  days: string[];
  dayCount: number;
  reason: string;
  status: LeaveStatus;
  payType: PayType | null;
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface LeaveListResponse {
  leaves: LeaveView[];
}

export interface LeaveResponse {
  leave: LeaveView;
}

export interface TodayRecord {
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
}

export interface TodayResponse {
  today: TodayRecord;
  /** Present when today is a weekly off or holiday, so the UI can say so. Check-in still works. */
  offReason: string | null;
  /** An approved leave covering today, if any. */
  leaveToday: { halfDay: boolean; payType: PayType | null } | null;
}

export interface DayCell {
  day: string;
  status: DayStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  override: OverrideStatus | null;
  overrideNote: string | null;
  leave: { id: string; type: LeaveType; halfDay: boolean; payType: PayType | null } | null;
  holiday: string | null;
}

export interface PersonMonth {
  user: PublicUser;
  days: DayCell[];
  summary: MonthSummary;
}

export interface MyMonthResponse {
  month: string;
  today: string;
  person: PersonMonth;
}

export interface TeamMonthResponse {
  month: string;
  today: string;
  people: PersonMonth[];
}

export interface OverviewResponse {
  today: string;
  isOffDay: boolean;
  counts: { employees: number; checkedIn: number; onLeave: number; notMarked: number; pendingLeaves: number };
  checkedIn: { user: PublicUser; checkInAt: string; checkOutAt: string | null }[];
  onLeave: { user: PublicUser; halfDay: boolean; payType: PayType | null; type: LeaveType }[];
  notMarked: PublicUser[];
}

export interface EmployeeView extends PublicUser {
  lastLoginAt: string | null;
  createdAt: string;
  /** Listed in ADMIN_EMAILS, so the app cannot demote or turn them off. */
  lockedAdmin: boolean;
}

export interface EmployeesResponse {
  employees: EmployeeView[];
}

export interface SettingsResponse {
  settings: AppSettings;
}
