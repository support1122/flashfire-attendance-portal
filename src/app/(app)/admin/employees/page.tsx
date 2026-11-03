"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AdminOnly } from "@/components/AppShell";
import { Alert, Badge, Button, Card, Empty, Field, inputClass, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { keys, useMe } from "@/lib/queries";
import type { EmployeesResponse, EmployeeView, Role } from "@/lib/types";

function useInvalidatePeople() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: keys.me });
  };
}

function AddPerson() {
  const invalidate = useInvalidatePeople();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const add = useMutation({
    mutationFn: () => api("/api/admin/employees", { body: { email, name, role } }),
    onSuccess: () => {
      setEmail("");
      setName("");
      setRole("employee");
      invalidate();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5">
      <p className="text-sm text-slate-600">Anyone at an allowed domain can sign in on their own. Add people here to let in other emails or to make someone an admin up front.</p>
      {add.isError && <Alert>{errorMessage(add.error)}</Alert>}
      {add.isSuccess && <Alert tone="green">Added. They can sign in with a code now.</Alert>}
      <Field label="Email" htmlFor="new-email">
        <input id="new-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="name@company.com" />
      </Field>
      <Field label="Name" htmlFor="new-name" hint="Leave empty to use the part before the @.">
        <input id="new-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Role" htmlFor="new-role">
        <select id="new-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      <Button type="submit" loading={add.isPending} className="w-full"><UserPlus size={16} aria-hidden /> Add person</Button>
    </form>
  );
}

function RenameModal({ person, onClose }: { person: EmployeeView; onClose: () => void }) {
  const invalidate = useInvalidatePeople();
  const [name, setName] = useState(person.name);
  const save = useMutation({
    mutationFn: () => api(`/api/admin/employees/${person.id}`, { method: "PATCH", body: { name } }),
    onSuccess: () => { invalidate(); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Rename">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Name" htmlFor="rename">
          <input id="rename" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
        </Field>
        {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={save.isPending}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function PersonRow({ person, isSelf }: { person: EmployeeView; isSelf: boolean }) {
  const invalidate = useInvalidatePeople();
  const [renaming, setRenaming] = useState(false);
  const update = useMutation({
    mutationFn: (body: { role?: Role; isActive?: boolean }) => api(`/api/admin/employees/${person.id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });
  const locked = person.lockedAdmin || isSelf;

  return (
    <tr className={person.isActive ? "" : "bg-slate-50 text-slate-500"}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{person.name}</span>
          {isSelf && <Badge>You</Badge>}
          {!person.isActive && <Badge tone="red">Off</Badge>}
          <button type="button" onClick={() => setRenaming(true)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Rename ${person.name}`}>
            <Pencil size={14} />
          </button>
        </div>
        <div className="text-xs text-slate-500">{person.email}</div>
        {update.isError && <p className="mt-1 text-xs text-red-600">{errorMessage(update.error)}</p>}
      </td>
      <td className="px-3 py-3">
        <label className="sr-only" htmlFor={`role-${person.id}`}>Role for {person.name}</label>
        <select
          id={`role-${person.id}`}
          value={person.role}
          disabled={locked || update.isPending}
          title={person.lockedAdmin ? "Admin through ADMIN_EMAILS" : isSelf ? "You can't change your own role" : undefined}
          onChange={(e) => update.mutate({ role: e.target.value as Role })}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-500"
        >
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="hidden px-3 py-3 text-sm md:table-cell">
        {person.lastLoginAt ? new Date(person.lastLoginAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Never"}
      </td>
      <td className="px-5 py-3 text-right">
        {!locked && (
          <Button size="sm" variant={person.isActive ? "danger" : "secondary"} loading={update.isPending} onClick={() => update.mutate({ isActive: !person.isActive })}>
            {person.isActive ? "Turn off" : "Turn on"}
          </Button>
        )}
      </td>
      {renaming && <RenameModal person={person} onClose={() => setRenaming(false)} />}
    </tr>
  );
}

function People() {
  const me = useMe();
  const people = useQuery({ queryKey: keys.employees, queryFn: () => api<EmployeesResponse>("/api/admin/employees") });

  return (
    <>
      <PageHeader title="People" subtitle="Who can sign in, and who is an admin." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          {people.isPending ? (
            <Spinner />
          ) : people.isError ? (
            <div className="p-5"><Alert>{errorMessage(people.error)}</Alert></div>
          ) : people.data.employees.length === 0 ? (
            <Empty>No one yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-2.5">Person</th>
                    <th scope="col" className="px-3 py-2.5">Role</th>
                    <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Last sign-in</th>
                    <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {people.data.employees.map((p) => <PersonRow key={p.id} person={p} isSelf={p.id === me.data?.user.id} />)}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Add a person" className="self-start"><AddPerson /></Card>
      </div>
    </>
  );
}

export default function EmployeesPage() {
  return <AdminOnly><People /></AdminOnly>;
}
