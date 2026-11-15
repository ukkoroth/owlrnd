"use client";

import { useActionState, useState } from "react";
import { Field, FormError, Notice, SubmitButton } from "@/components/forms";
import { SectionLabel } from "@/components/PageHeader";
import { rules } from "@/config/rules";
import { emptyForm } from "@/lib/form";
import { removeStudent, setStudentPassword, updateStudent } from "../../actions";

type S = { id: string; name: string; className: string; username: string };

export function EditStudentForms({ student }: { student: S }) {
  return (
    <div className="flex flex-col gap-6">
      <DetailsForm student={student} />
      <PasswordForm student={student} />
      <RemoveCard student={student} />
    </div>
  );
}

function DetailsForm({ student }: { student: S }) {
  const [state, action] = useActionState(updateStudent.bind(null, student.id), emptyForm);
  const v = state.values ?? student;
  const f = state.fieldErrors;
  return (
    <section className="card">
      <SectionLabel>Details</SectionLabel>
      <form action={action} className="flex flex-col gap-4">
        <FormError>{state.error}</FormError>
        <Notice>{state.notice}</Notice>
        <Field label="Student's name" name="name" required autoComplete="off" defaultValue={v.name} key={`n${v.name}`} error={f?.name} />
        <Field label="Class" name="className" required autoComplete="off" defaultValue={v.className} key={`c${v.className}`} error={f?.className} />
        <Field
          label="Username"
          name="username"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={v.username}
          key={`u${v.username}`}
          hint={`${student.name} signs in with this.`}
          error={f?.username}
        />
        <div>
          <SubmitButton className="btn-primary">Save changes</SubmitButton>
        </div>
      </form>
    </section>
  );
}

function PasswordForm({ student }: { student: S }) {
  const [state, action] = useActionState(setStudentPassword.bind(null, student.id), emptyForm);
  return (
    <section className="card">
      <SectionLabel>Password</SectionLabel>
      <form action={action} className="flex flex-col gap-4">
        <Notice>{state.notice}</Notice>
        <Field
          label={`New password for ${student.name}`}
          name="password"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          minLength={rules.accounts.passwordMinLength}
          defaultValue={state.values?.password}
          key={state.values?.password}
          hint={`Shown so you can pass it on. ${student.name} will be signed out and will need it the next time they sign in.`}
          error={state.fieldErrors?.password}
        />
        <div>
          <SubmitButton className="btn-primary">Set new password</SubmitButton>
        </div>
      </form>
    </section>
  );
}

function RemoveCard({ student }: { student: S }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="card border-danger/50">
      <SectionLabel>Remove student</SectionLabel>
      <p className="text-ink-muted">Removes {student.name}&apos;s account, with all their tracks, exams and points. This cannot be undone.</p>
      {!confirming ? (
        <button type="button" className="btn-danger mt-4" onClick={() => setConfirming(true)}>
          Remove {student.name}
        </button>
      ) : (
        <form action={removeStudent.bind(null, student.id)} className="mt-4 rounded border border-danger bg-danger-fill p-4" role="alertdialog" aria-label={`Remove ${student.name}`}>
          <p className="font-semibold text-danger-text">Remove {student.name} for good? This cannot be undone.</p>
          <div className="mt-3 flex gap-3">
            <SubmitButton className="btn-danger">Yes, remove {student.name}</SubmitButton>
            <button type="button" className="btn-outline" onClick={() => setConfirming(false)} autoFocus>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
