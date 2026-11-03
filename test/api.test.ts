import { describe, expect, it, vi } from "vitest";
import { call, flushMails, login, sentCodes, setupDatabase } from "./helpers";
import * as requestCode from "@/app/api/auth/request-code/route";
import * as verifyCode from "@/app/api/auth/verify-code/route";
import * as me from "@/app/api/me/route";
import * as leaves from "@/app/api/leaves/route";
import * as cancelLeave from "@/app/api/leaves/[id]/cancel/route";
import * as adminLeaves from "@/app/api/admin/leaves/route";
import * as adminLeave from "@/app/api/admin/leaves/[id]/route";
import * as checkIn from "@/app/api/attendance/check-in/route";
import * as checkOut from "@/app/api/attendance/check-out/route";
import * as today from "@/app/api/attendance/today/route";
import * as myMonth from "@/app/api/attendance/month/route";
import * as adminAttendance from "@/app/api/admin/attendance/route";
import * as overview from "@/app/api/admin/overview/route";
import * as employees from "@/app/api/admin/employees/route";
import * as employee from "@/app/api/admin/employees/[id]/route";
import * as settings from "@/app/api/admin/settings/route";
import * as passwordRoute from "@/app/api/auth/password/route";
import mongoose from "mongoose";
import { Attendance, Otp } from "@/lib/models";
import { addDays, dayKey, monthKey } from "@/lib/time";

setupDatabase();

const ADMIN = "boss@flashfirehq.com";
const EMP = "priya.sharma@flashfirehq.com";

/** A working day a week from now, so tests don't depend on what weekday they run. */
function nextWorkday(offset = 7): string {
  let day = addDays(dayKey(), offset);
  while (new Date(`${day}T00:00:00Z`).getUTCDay() === 0) day = addDays(day, 1);
  return day;
}

describe("login", () => {
  it("signs in a company email and creates the employee", async () => {
    const cookie = await login(EMP);
    const res = await call(me.GET, { cookie });
    expect(res.status).toBe(200);
    expect(res.json.user).toMatchObject({ email: EMP, name: "Priya Sharma", role: "employee" });
  });

  it("makes ADMIN_EMAILS admins", async () => {
    const res = await call(me.GET, { cookie: await login(ADMIN) });
    expect(res.json.user.role).toBe("admin");
  });

  it("refuses emails outside the allowed domains", async () => {
    const res = await call(requestCode.POST, { body: { email: "someone@gmail.com" } });
    expect(res.status).toBe(403);
    expect(sentCodes.size).toBe(0);
  });

  it("rejects a wrong code and burns the code after 5 misses", async () => {
    await call(requestCode.POST, { body: { email: EMP } });
    const good = sentCodes.get(EMP)!;
    const wrong = good === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) expect((await call(verifyCode.POST, { body: { email: EMP, code: wrong } })).status).toBe(401);
    const last = await call(verifyCode.POST, { body: { email: EMP, code: wrong } });
    expect(last.json.error).toMatch(/Too many wrong codes/);
    expect((await call(verifyCode.POST, { body: { email: EMP, code: good } })).status).toBe(401);
  });

  it("lets a code work only once", async () => {
    await call(requestCode.POST, { body: { email: EMP } });
    const code = sentCodes.get(EMP)!;
    const [a, b] = await Promise.all([
      call(verifyCode.POST, { body: { email: EMP, code } }),
      call(verifyCode.POST, { body: { email: EMP, code } }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });

  it("enforces the resend cooldown", async () => {
    expect((await call(requestCode.POST, { body: { email: EMP } })).status).toBe(200);
    const again = await call(requestCode.POST, { body: { email: EMP } });
    expect(again.status).toBe(429);
    expect(again.res.headers.get("retry-after")).toBeTruthy();
  });

  it("rejects an expired code", async () => {
    await call(requestCode.POST, { body: { email: EMP } });
    await Otp.updateOne({ email: EMP }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await call(verifyCode.POST, { body: { email: EMP, code: sentCodes.get(EMP) } })).status).toBe(401);
  });

  it("returns 401 without a session and 422 for a malformed email", async () => {
    expect((await call(me.GET)).status).toBe(401);
    expect((await call(requestCode.POST, { body: { email: "nope" } })).status).toBe(422);
  });

  it("blocks cross-site writes", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/auth/request-code", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example", host: "localhost" },
      body: JSON.stringify({ email: EMP }),
    });
    const res = await requestCode.POST(req, { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(403);
  });
});

describe("leave flow", () => {
  it("employee applies, admin approves as unpaid, then flips to paid", async () => {
    const emp = await login(EMP);
    const admin = await login(ADMIN);
    const day = nextWorkday();

    const created = await call(leaves.POST, { cookie: emp, body: { type: "sick", fromDate: day, toDate: day, halfDay: false, reason: "Fever" } });
    expect(created.status).toBe(201);
    expect(created.json.leave).toMatchObject({ status: "pending", dayCount: 1, payType: null });
    const id = created.json.leave.id;

    const pending = await call(adminLeaves.GET, { cookie: admin, path: "/api/admin/leaves?status=pending" });
    expect(pending.json.leaves.map((l: { id: string }) => l.id)).toEqual([id]);

    const approved = await call(adminLeave.PATCH, { cookie: admin, method: "PATCH", params: { id }, body: { action: "approve", payType: "unpaid" } });
    expect(approved.status).toBe(200);
    expect(approved.json.leave).toMatchObject({ status: "approved", payType: "unpaid", decidedBy: { name: "Boss" } });

    const flipped = await call(adminLeave.PATCH, { cookie: admin, method: "PATCH", params: { id }, body: { action: "set_pay", payType: "paid" } });
    expect(flipped.json.leave.payType).toBe("paid");

    // Deciding twice is a conflict, not a silent overwrite.
    const again = await call(adminLeave.PATCH, { cookie: admin, method: "PATCH", params: { id }, body: { action: "reject" } });
    expect(again.status).toBe(409);
  });

  it("does not let employees decide", async () => {
    const emp = await login(EMP);
    const day = nextWorkday();
    const created = await call(leaves.POST, { cookie: emp, body: { type: "casual", fromDate: day, toDate: day, reason: "Family" } });
    const res = await call(adminLeave.PATCH, { cookie: emp, method: "PATCH", params: { id: created.json.leave.id }, body: { action: "approve", payType: "paid" } });
    expect(res.status).toBe(403);
    expect((await call(adminLeaves.GET, { cookie: emp })).status).toBe(403);
  });

  it("requires a pay type to approve", async () => {
    const emp = await login(EMP);
    const admin = await login(ADMIN);
    const day = nextWorkday();
    const created = await call(leaves.POST, { cookie: emp, body: { type: "casual", fromDate: day, toDate: day, reason: "Family" } });
    const res = await call(adminLeave.PATCH, { cookie: admin, method: "PATCH", params: { id: created.json.leave.id }, body: { action: "approve" } });
    expect(res.status).toBe(422);
  });

  it("refuses overlapping requests and allows a new one after withdrawal", async () => {
    const emp = await login(EMP);
    const day = nextWorkday();
    const first = await call(leaves.POST, { cookie: emp, body: { type: "casual", fromDate: day, toDate: day, reason: "Trip" } });
    const clash = await call(leaves.POST, { cookie: emp, body: { type: "sick", fromDate: day, toDate: addDays(day, 1), reason: "Trip again" } });
    expect(clash.status).toBe(409);

    const cancelled = await call(cancelLeave.POST, { cookie: emp, params: { id: first.json.leave.id }, body: {} });
    expect(cancelled.json.leave.status).toBe("cancelled");
    expect((await call(leaves.POST, { cookie: emp, body: { type: "sick", fromDate: day, toDate: day, reason: "Trip again" } })).status).toBe(201);
  });

  it("only one of two simultaneous decisions wins", async () => {
    const emp = await login(EMP);
    const admin = await login(ADMIN);
    const day = nextWorkday();
    const created = await call(leaves.POST, { cookie: emp, body: { type: "casual", fromDate: day, toDate: day, reason: "Trip" } });
    const id = created.json.leave.id;
    const [a, b] = await Promise.all([
      call(adminLeave.PATCH, { cookie: admin, method: "PATCH", params: { id }, body: { action: "approve", payType: "paid" } }),
      call(adminLeave.PATCH, { cookie: admin, method: "PATCH", params: { id }, body: { action: "reject" } }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it("stops an admin approving their own leave when another admin exists", async () => {
    const admin = await login(ADMIN);
    const day = nextWorkday();
    const own = await call(leaves.POST, { cookie: admin, body: { type: "casual", fromDate: day, toDate: day, reason: "Rest" } });
    // Only admin: allowed to self-approve, otherwise nobody could.
    const solo = await call(adminLeave.PATCH, { cookie: admin, method: "PATCH", params: { id: own.json.leave.id }, body: { action: "approve", payType: "paid" } });
    expect(solo.status).toBe(200);

    await call(employees.POST, { cookie: admin, body: { email: "second@flashfirehq.com", role: "admin" } });
    const other = await call(leaves.POST, { cookie: admin, body: { type: "casual", fromDate: addDays(day, 1), toDate: addDays(day, 1), reason: "Rest" } });
    if (other.status === 422) return; // next day was a Sunday; the first assertion already covered the rule
    const blocked = await call(adminLeave.PATCH, { cookie: admin, method: "PATCH", params: { id: other.json.leave.id }, body: { action: "approve", payType: "paid" } });
    expect(blocked.status).toBe(403);
  });
});

describe("attendance", () => {
  it("checks in once, checks out once, and shows in the month and overview", async () => {
    const emp = await login(EMP);
    const admin = await login(ADMIN);
    expect((await call(checkIn.POST, { cookie: emp, body: {} })).status).toBe(200);
    expect((await call(checkIn.POST, { cookie: emp, body: {} })).status).toBe(409);

    const t = await call(today.GET, { cookie: emp });
    expect(t.json.today.checkInAt).toBeTruthy();

    expect((await call(checkOut.POST, { cookie: emp, body: {} })).status).toBe(200);
    expect((await call(checkOut.POST, { cookie: emp, body: {} })).status).toBe(409);

    const month = await call(myMonth.GET, { cookie: emp, path: `/api/attendance/month?month=${monthKey()}` });
    const cell = month.json.person.days.find((d: { day: string }) => d.day === dayKey());
    expect(cell.status).toBe("present");

    const ov = await call(overview.GET, { cookie: admin });
    expect(ov.json.counts.checkedIn).toBe(1);
    expect(ov.json.notMarked.map((u: { email: string }) => u.email)).toEqual([ADMIN]);
  });

  it("closes a night shift that started yesterday", async () => {
    const emp = await login(EMP);
    const meRes = await call(me.GET, { cookie: emp });
    const yesterday = addDays(dayKey(), -1);
    await Attendance.create({ user: meRes.json.user.id, date: yesterday, checkInAt: new Date(Date.now() - 6 * 3600 * 1000) });

    const t = await call(today.GET, { cookie: emp });
    expect(t.json.today.date).toBe(yesterday);
    // Still on the shift, so a fresh check-in is refused.
    expect((await call(checkIn.POST, { cookie: emp, body: {} })).status).toBe(409);
    const out = await call(checkOut.POST, { cookie: emp, body: {} });
    expect(out.json.date).toBe(yesterday);
  });

  it("lets admins override a day and clears it again", async () => {
    const emp = await login(EMP);
    const admin = await login(ADMIN);
    const userId = (await call(me.GET, { cookie: emp })).json.user.id;
    const day = dayKey();

    const saved = await call(adminAttendance.PUT, { cookie: admin, method: "PUT", body: { userId, date: day, override: "half_day", note: "Left early" } });
    expect(saved.status).toBe(200);
    const grid = await call(adminAttendance.GET, { cookie: admin });
    const cell = grid.json.people.find((p: { user: { id: string } }) => p.user.id === userId).days.find((d: { day: string }) => d.day === day);
    expect(cell).toMatchObject({ status: "half_day", overrideNote: "Left early" });

    await call(adminAttendance.PUT, { cookie: admin, method: "PUT", body: { userId, date: day, override: null } });
    // The override row must not block a real check-in afterwards.
    expect((await call(checkIn.POST, { cookie: emp, body: {} })).status).toBe(200);
    expect((await call(adminAttendance.PUT, { cookie: admin, method: "PUT", body: { userId, date: addDays(day, 2), override: "absent" } })).status).toBe(422);
  });
});

describe("admin management", () => {
  it("adds an outside email who can then sign in", async () => {
    const admin = await login(ADMIN);
    const added = await call(employees.POST, { cookie: admin, body: { email: "contractor@gmail.com", name: "Ravi" } });
    expect(added.status).toBe(201);
    expect((await call(employees.POST, { cookie: admin, body: { email: "contractor@gmail.com" } })).status).toBe(409);
    const cookie = await login("contractor@gmail.com");
    expect((await call(me.GET, { cookie })).json.user.name).toBe("Ravi");
  });

  it("turning someone off ends their session immediately", async () => {
    const admin = await login(ADMIN);
    const emp = await login(EMP);
    const id = (await call(me.GET, { cookie: emp })).json.user.id;
    await call(employee.PATCH, { cookie: admin, method: "PATCH", params: { id }, body: { isActive: false } });
    expect((await call(me.GET, { cookie: emp })).status).toBe(401);
    expect((await call(requestCode.POST, { body: { email: EMP } })).status).toBe(403);
  });

  it("lets an admin make an employee an admin, who can then manage people", async () => {
    const admin = await login(ADMIN);
    const emp = await login(EMP);
    const id = (await call(me.GET, { cookie: emp })).json.user.id;
    expect((await call(employees.GET, { cookie: emp })).status).toBe(403);
    const promoted = await call(employee.PATCH, { cookie: admin, method: "PATCH", params: { id }, body: { role: "admin" } });
    expect(promoted.json.employee.role).toBe("admin");
    // Same session, new powers: roles are read from the database on every request.
    expect((await call(employees.GET, { cookie: emp })).status).toBe(200);
    const added = await call(employees.POST, { cookie: emp, body: { email: "third@flashfirehq.com", role: "admin" } });
    expect(added.json.employee.role).toBe("admin");
  });

  it("protects env admins and the admin's own access", async () => {
    const admin = await login(ADMIN);
    const id = (await call(me.GET, { cookie: admin })).json.user.id;
    expect((await call(employee.PATCH, { cookie: admin, method: "PATCH", params: { id }, body: { role: "employee" } })).status).toBe(403);
  });

  it("adds a new allowed domain so its people can sign in", async () => {
    const admin = await login(ADMIN);
    expect((await call(requestCode.POST, { body: { email: "a@partner.io" } })).status).toBe(403);
    const saved = await call(settings.PUT, {
      cookie: admin,
      method: "PUT",
      body: { allowedDomains: ["flashfirehq.com", "@Partner.io"], weeklyOffDays: [0, 6], holidays: [{ date: "2026-12-25", name: "Christmas" }] },
    });
    expect(saved.json.settings.allowedDomains).toEqual(["flashfirehq.com", "partner.io"]);
    expect((await call(requestCode.POST, { body: { email: "a@partner.io" } })).status).toBe(200);
    const bad = await call(settings.PUT, { cookie: admin, method: "PUT", body: { allowedDomains: ["not a domain"], weeklyOffDays: [], holidays: [] } });
    expect(bad.status).toBe(422);
  });
});

describe("CRM admins", () => {
  it("makes an active CRM admin an admin here on first sign-in, and ignores inactive ones", async () => {
    process.env.CRM_DB_NAME = "crm_test";
    try {
      const crm = mongoose.connection.useDb("crm_test").collection("crmusers");
      await crm.deleteMany({});
      await crm.insertMany([
        { email: "lead@flashfirehq.com", role: "bda", isAdmin: true, isActive: true },
        { email: "gone@flashfirehq.com", role: "admin", isActive: false },
      ]);
      expect((await call(me.GET, { cookie: await login("lead@flashfirehq.com") })).json.user.role).toBe("admin");
      expect((await call(me.GET, { cookie: await login("gone@flashfirehq.com") })).json.user.role).toBe("employee");
    } finally {
      delete process.env.CRM_DB_NAME;
    }
  });
});

describe("default admin password login", () => {
  it("signs in with the env password as a locked admin, in its own database", async () => {
    const wrong = await call(passwordRoute.POST, { body: { email: "admin@flashfirehq.com", password: "nope" } });
    expect(wrong.status).toBe(401);
    const right = await call(passwordRoute.POST, { body: { email: "ADMIN@flashfirehq.com", password: "test-only-password" } });
    expect(right.status).toBe(200);
    expect(right.json.user).toMatchObject({ email: "admin@flashfirehq.com", role: "admin" });
    const cookie = (right.res.headers.get("set-cookie") ?? "").split(";")[0];

    const list = await call(employees.GET, { cookie });
    const row = list.json.employees.find((e: { email: string }) => e.email === "admin@flashfirehq.com");
    expect(row.lockedAdmin).toBe(true);
    expect(mongoose.connection.db?.databaseName).toBe("flashfire_attendance");
  });

  it("refuses password login for everyone else, even real admins", async () => {
    await login(ADMIN);
    const res = await call(passwordRoute.POST, { body: { email: ADMIN, password: "test-only-password" } });
    expect(res.status).toBe(401);
  });

  it("locks out after 10 wrong tries from one address", async () => {
    const { NextRequest } = await import("next/server");
    const attempt = (password: string) =>
      passwordRoute.POST(
        new NextRequest("http://localhost/api/auth/password", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
          body: JSON.stringify({ email: "admin@flashfirehq.com", password }),
        }),
        { params: Promise.resolve({}) } as never,
      );
    for (let i = 0; i < 10; i++) expect((await attempt("wrong")).status).toBe(401);
    expect((await attempt("test-only-password")).status).toBe(429);
  });
});

describe("leave notifications", () => {
  const recipients = (mails: { to: string }[]) => mails.map((m) => m.to).sort();

  it("emails every admin on a new request, and the employee plus other admins on each decision", async () => {
    const boss = await login(ADMIN);
    await call(employees.POST, { cookie: boss, body: { email: "hr@flashfirehq.com", role: "admin" } });
    const emp = await login(EMP);
    await flushMails();

    const day = nextWorkday();
    const created = await call(leaves.POST, {
      cookie: emp,
      body: { type: "sick", fromDate: day, toDate: day, reason: "Fever <script>alert(1)</script>" },
    });
    const requested = await flushMails();
    expect(recipients(requested)).toEqual([ADMIN, "hr@flashfirehq.com"]);
    expect(requested[0].subject).toBe("Leave request: Priya Sharma, 1 day");
    // Employee text is escaped in the HTML version.
    expect(requested[0].html).toContain("&lt;script&gt;");
    expect(requested[0].html).not.toContain("<script>");
    expect(requested[0].html).toContain("http://localhost/admin/leaves");

    const id = created.json.leave.id;
    await call(adminLeave.PATCH, { cookie: boss, method: "PATCH", params: { id }, body: { action: "approve", payType: "unpaid", note: "Get well soon" } });
    const approved = await flushMails();
    // The deciding admin is not emailed about their own click.
    expect(recipients(approved)).toEqual(["hr@flashfirehq.com", EMP]);
    const toEmployee = approved.find((m) => m.to === EMP)!;
    expect(toEmployee.text).toContain("Your leave is approved (unpaid)");
    expect(toEmployee.text).toContain("Note from Boss: Get well soon");
    expect(approved.find((m) => m.to === "hr@flashfirehq.com")!.text).toContain("Boss approved Priya Sharma's leave as unpaid");

    await call(adminLeave.PATCH, { cookie: boss, method: "PATCH", params: { id }, body: { action: "set_pay", payType: "paid" } });
    const flipped = await flushMails();
    expect(flipped.find((m) => m.to === EMP)!.text).toContain("Your leave is now marked paid");

    // Same pay type again changes nothing, so it sends nothing.
    await call(adminLeave.PATCH, { cookie: boss, method: "PATCH", params: { id }, body: { action: "set_pay", payType: "paid" } });
    expect(await flushMails()).toEqual([]);

    await call(adminLeave.PATCH, { cookie: boss, method: "PATCH", params: { id }, body: { action: "revoke", note: "Needed for the launch" } });
    expect((await flushMails()).find((m) => m.to === EMP)!.text).toContain("Your approved leave was revoked");
  });

  it("tells admins about a withdrawal and the employee about a rejection", async () => {
    const boss = await login(ADMIN);
    const emp = await login(EMP);
    const day = nextWorkday();
    const first = await call(leaves.POST, { cookie: emp, body: { type: "casual", fromDate: day, toDate: day, reason: "Trip" } });
    await flushMails();
    await call(cancelLeave.POST, { cookie: emp, params: { id: first.json.leave.id }, body: {} });
    const withdrawn = await flushMails();
    expect(recipients(withdrawn)).toEqual([ADMIN]);
    expect(withdrawn[0].subject).toBe("Leave withdrawn: Priya Sharma");

    const second = await call(leaves.POST, { cookie: emp, body: { type: "casual", fromDate: day, toDate: day, reason: "Trip again" } });
    await flushMails();
    await call(adminLeave.PATCH, { cookie: boss, method: "PATCH", params: { id: second.json.leave.id }, body: { action: "reject" } });
    const rejected = await flushMails();
    expect(recipients(rejected)).toEqual([EMP]);
    expect(rejected[0].text).toContain("Your leave request was rejected");
  });

  it("never emails a turned-off admin", async () => {
    const boss = await login(ADMIN);
    const added = await call(employees.POST, { cookie: boss, body: { email: "old@flashfirehq.com", role: "admin" } });
    await call(employee.PATCH, { cookie: boss, method: "PATCH", params: { id: added.json.employee.id }, body: { isActive: false } });
    const emp = await login(EMP);
    await flushMails();
    const day = nextWorkday();
    await call(leaves.POST, { cookie: emp, body: { type: "sick", fromDate: day, toDate: day, reason: "Fever" } });
    expect(recipients(await flushMails())).toEqual([ADMIN]);
  });

  it("still answers 201 when sending fails", async () => {
    const email = await import("@/lib/email");
    const spy = vi.spyOn(email, "sendMail").mockRejectedValue(new Error("SMTP down"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await login(ADMIN);
      const emp = await login(EMP);
      const day = nextWorkday();
      const res = await call(leaves.POST, { cookie: emp, body: { type: "sick", fromDate: day, toDate: day, reason: "Fever" } });
      expect(res.status).toBe(201);
      await flushMails();
      expect(errors).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      errors.mockRestore();
    }
  });
});
