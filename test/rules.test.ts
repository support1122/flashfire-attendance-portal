import { describe, expect, it } from "vitest";
import { computeLeaveDays, dayStatus, summarize } from "@/lib/rules";
import { addDays, dayKey, daysInMonth, isDayKey, isMonthKey } from "@/lib/time";
import type { AppSettings } from "@/lib/types";

const settings: AppSettings = { allowedDomains: [], weeklyOffDays: [0], holidays: [{ date: "2026-11-11", name: "Diwali" }] };
const today = "2026-11-02"; // a Monday

describe("time helpers", () => {
  it("keys days in IST, not UTC", () => {
    // 20:00 UTC on Nov 1 is 01:30 IST on Nov 2.
    expect(dayKey(new Date("2026-11-01T20:00:00Z"))).toBe("2026-11-02");
    expect(dayKey(new Date("2026-11-01T18:00:00Z"))).toBe("2026-11-01");
  });
  it("rejects impossible dates", () => {
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-02-28")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
  });
  it("lists every day of a month", () => {
    expect(daysInMonth("2028-02")).toHaveLength(29);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("computeLeaveDays", () => {
  it("skips weekly offs and holidays", () => {
    // Nov 9 (Mon) to Nov 15 (Sun): Diwali on the 11th and Sunday the 15th are free.
    const result = computeLeaveDays({ fromDate: "2026-11-09", toDate: "2026-11-15", halfDay: false }, settings, today);
    expect(result).toEqual({ ok: true, days: ["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13", "2026-11-14"], dayCount: 5 });
  });
  it("counts a half day as 0.5", () => {
    expect(computeLeaveDays({ fromDate: "2026-11-03", toDate: "2026-11-03", halfDay: true }, settings, today)).toMatchObject({ dayCount: 0.5 });
  });
  it("refuses a half day across several dates", () => {
    expect(computeLeaveDays({ fromDate: "2026-11-03", toDate: "2026-11-04", halfDay: true }, settings, today).ok).toBe(false);
  });
  it("refuses a request that only covers off days", () => {
    expect(computeLeaveDays({ fromDate: "2026-11-08", toDate: "2026-11-08", halfDay: false }, settings, today).ok).toBe(false);
  });
  it("refuses reversed and oversized ranges", () => {
    expect(computeLeaveDays({ fromDate: "2026-11-05", toDate: "2026-11-04", halfDay: false }, settings, today).ok).toBe(false);
    expect(computeLeaveDays({ fromDate: "2026-11-05", toDate: "2027-02-05", halfDay: false }, settings, today).ok).toBe(false);
    expect(computeLeaveDays({ fromDate: "2026-08-01", toDate: "2026-08-02", halfDay: false }, settings, today).ok).toBe(false);
  });
});

describe("dayStatus", () => {
  const base = { today, joinedDay: "2026-10-01", settings, record: null, leave: null };
  it("follows the precedence order", () => {
    const record = { checkInAt: "2026-10-27T04:00:00Z", checkOutAt: null, override: null };
    expect(dayStatus({ ...base, day: "2026-10-27", record: { ...record, override: "absent" }, leave: { halfDay: false, payType: "paid" } })).toBe("absent");
    expect(dayStatus({ ...base, day: "2026-10-27", record, leave: { halfDay: false, payType: "paid" } })).toBe("leave");
    expect(dayStatus({ ...base, day: "2026-10-25", record })).toBe("present"); // Sunday check-in still counts
    expect(dayStatus({ ...base, day: "2026-10-25" })).toBe("off");
    expect(dayStatus({ ...base, day: "2026-10-27" })).toBe("absent");
    expect(dayStatus({ ...base, day: today })).toBe("not_marked");
    expect(dayStatus({ ...base, day: "2026-11-03" })).toBe("upcoming");
    expect(dayStatus({ ...base, day: "2026-09-30" })).toBe("before_joining");
  });
});

describe("summarize", () => {
  it("splits leave by pay type and counts half days", () => {
    const summary = summarize([
      { status: "present", leave: null },
      { status: "half_day", leave: null },
      { status: "absent", leave: null },
      { status: "leave", leave: { halfDay: false, payType: "paid" } },
      { status: "leave", leave: { halfDay: true, payType: "unpaid" } },
    ]);
    expect(summary).toEqual({ present: 1, halfDay: 1, absent: 1, paidLeave: 1, unpaidLeave: 0.5, unsetLeave: 0 });
  });
});
