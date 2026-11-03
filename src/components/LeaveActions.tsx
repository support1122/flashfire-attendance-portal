"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { dayCountLabel, LEAVE_TYPE_LABEL, leaveRange } from "./labels";
import { Alert, Button, Field, inputClass, Modal } from "./ui";
import { api, errorMessage } from "@/lib/api";
import type { LeaveResponse, LeaveView, PayType } from "@/lib/types";

type Action = "approve" | "reject" | "revoke";

const COPY: Record<Action, { title: string; confirm: string; variant: "success" | "danger" }> = {
  approve: { title: "Approve leave", confirm: "Approve", variant: "success" },
  reject: { title: "Reject leave", confirm: "Reject", variant: "danger" },
  revoke: { title: "Revoke approved leave", confirm: "Revoke", variant: "danger" },
};

function useLeaveMutation(leave: LeaveView, onDone?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<LeaveResponse>(`/api/admin/leaves/${leave.id}`, { method: "PATCH", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      onDone?.();
    },
  });
}

function DecideModal({ leave, action, onClose }: { leave: LeaveView; action: Action; onClose: () => void }) {
  const [payType, setPayType] = useState<PayType>("paid");
  const [note, setNote] = useState("");
  const mutation = useLeaveMutation(leave, onClose);
  const copy = COPY[action];

  return (
    <Modal open onClose={onClose} title={copy.title}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(action === "approve" ? { action, payType, note } : { action, note });
        }}
      >
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-900">{leave.user.name}</p>
          <p className="text-slate-600">
            {leaveRange(leave.fromDate, leave.toDate, leave.halfDay)} · {LEAVE_TYPE_LABEL[leave.type]} · {dayCountLabel(leave.dayCount)}
          </p>
          <p className="mt-1 break-words text-slate-600">{leave.reason}</p>
        </div>
        {action === "approve" && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Pay</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["paid", "unpaid"] as const).map((value) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
                    payType === value ? "border-orange-500 bg-orange-50 text-orange-800" : "border-slate-300 text-slate-700"
                  }`}
                >
                  <input type="radio" name="payType" value={value} checked={payType === value} onChange={() => setPayType(value)} className="accent-orange-500" />
                  {value === "paid" ? "Paid" : "Unpaid"}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Field label="Note (optional)" htmlFor="decision-note" hint={`${leave.user.name.split(" ")[0]} sees this note.`}>
          <textarea id="decision-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </Field>
        {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={copy.variant} loading={mutation.isPending}>{copy.confirm}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** The buttons an admin sees on a leave row, depending on its status. */
export function LeaveActions({ leave }: { leave: LeaveView }) {
  const [action, setAction] = useState<Action | null>(null);
  const setPay = useLeaveMutation(leave);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {leave.status === "pending" && (
          <>
            <Button size="sm" variant="success" onClick={() => setAction("approve")}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => setAction("reject")}>Reject</Button>
          </>
        )}
        {leave.status === "approved" && (
          <>
            <label className="sr-only" htmlFor={`pay-${leave.id}`}>Pay type</label>
            <select
              id={`pay-${leave.id}`}
              value={leave.payType ?? ""}
              disabled={setPay.isPending}
              onChange={(e) => setPay.mutate({ action: "set_pay", payType: e.target.value })}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700"
            >
              {!leave.payType && <option value="" disabled>Set pay</option>}
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <Button size="sm" variant="ghost" onClick={() => setAction("revoke")}>Revoke</Button>
          </>
        )}
      </div>
      {setPay.isError && <p className="text-xs text-red-600">{errorMessage(setPay.error)}</p>}
      {action && <DecideModal leave={leave} action={action} onClose={() => setAction(null)} />}
    </div>
  );
}
