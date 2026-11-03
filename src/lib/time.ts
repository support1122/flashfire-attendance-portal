/**
 * Every "day" in the app is an IST calendar day written as YYYY-MM-DD.
 * IST has no daylight saving, so a fixed +05:30 offset is exact.
 * Safe to import on the client and the server.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function dayKey(date: Date = new Date()): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthKey(date: Date = new Date()): string {
  return dayKey(date).slice(0, 7);
}

/** Strict check: the shape must match and the date must exist (no 2026-02-30). */
export function isDayKey(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isMonthKey(value: string): boolean {
  return MONTH_RE.test(value) && isDayKey(`${value}-01`);
}

/** 0 = Sunday ... 6 = Saturday, for the calendar day itself (no timezone involved). */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

/** Inclusive range. Callers cap the span before calling. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export function daysInMonth(month: string): string[] {
  const first = `${month}-01`;
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return daysBetween(first, addDays(next.toISOString().slice(0, 10), -1));
}

export function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
});

export function formatTimeIST(iso: string | null): string {
  return iso ? timeFormat.format(new Date(iso)) : "-";
}

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function formatDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

const monthFormat = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });

export function formatMonth(month: string): string {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
