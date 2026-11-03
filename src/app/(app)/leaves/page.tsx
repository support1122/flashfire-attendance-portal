"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dayCountLabel, LEAVE_STATUS, LEAVE_TYPE_LABEL, leaveRange, PAY_LABEL } from "@/components/labels";
import { LeaveForm } from "@/components/LeaveForm";
import { Alert, Badge, Button, Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import type { LeaveListResponse, LeaveView } from "@/lib/types";

function LeaveRow({ leave }: { leave: LeaveView }) {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => api(`/api/leaves/${leave.id}/cancel`, { body: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.myLeaves });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  const status = LEAVE_STATUS[leave.status];

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">
            {leaveRange(leave.fromDate, leave.toDate, leave.halfDay)}
            <span className="ml-2 text-sm font-normal text-slate-500">
              {LEAVE_TYPE_LABEL[leave.type]} · {dayCountLabel(leave.dayCount)}
            </span>
          </p>
          <p className="mt-1 break-words text-sm text-slate-600">{leave.reason}</p>
          {leave.decisionNote && (
            <p className="mt-1 text-sm text-slate-500">
              {leave.decidedBy?.name ?? "Admin"}: “{leave.decisionNote}”
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {leave.payType && <Badge tone={PAY_LABEL[leave.payType].tone}>{PAY_LABEL[leave.payType].label}</Badge>}
          <Badge tone={status.tone}>{status.label}</Badge>
          {leave.status === "pending" && (
            <Button variant="ghost" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Withdraw
            </Button>
          )}
        </div>
      </div>
      {cancel.isError && <div className="mt-2"><Alert>{errorMessage(cancel.error)}</Alert></div>}
    </li>
  );
}

export default function MyLeavePage() {
  const leaves = useQuery({ queryKey: keys.myLeaves, queryFn: () => api<LeaveListResponse>("/api/leaves") });

  return (
    <>
      <PageHeader title="My leave" subtitle="Ask for time off and track what's been decided." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card title="Request leave" className="self-start">
          <LeaveForm />
        </Card>
        <Card title="Your requests">
          {leaves.isPending ? (
            <Spinner />
          ) : leaves.isError ? (
            <div className="p-5"><Alert>{errorMessage(leaves.error)}</Alert></div>
          ) : leaves.data.leaves.length === 0 ? (
            <Empty>No leave requests yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-200">
              {leaves.data.leaves.map((leave) => <LeaveRow key={leave.id} leave={leave} />)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
