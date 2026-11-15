"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AuthHeading, AuthLayout } from "@/components/AuthLayout";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { rules } from "@/config/rules";
import { createStudent, type CreatedStudent, type CreateState } from "@/app/(parent)/students/actions";

/** 2a, then 2b once the student exists. "Add another student" starts a fresh 2a (new key → fresh form state). */
export function AddStudentFlow({ parentEmail }: { parentEmail: string }) {
  const [round, setRound] = useState(0);
  return <Flow key={round} parentEmail={parentEmail} onAddAnother={() => setRound((r) => r + 1)} />;
}

function Flow({ parentEmail, onAddAnother }: { parentEmail: string; onAddAnother: () => void }) {
  const [state, action] = useActionState(createStudent, {} as CreateState);
  if (state.created) return <StudentAdded student={state.created} parentEmail={parentEmail} onAddAnother={onAddAnother} />;

  const v = state.values;
  const f = state.fieldErrors;
  return (
    <AuthLayout variant="steps" currentStep={2} headline="Now add your child.">
      <AuthHeading title="Set up the student account">Your child signs in with this username and password. No email is needed.</AuthHeading>
      <form action={action} className="flex flex-col gap-4">
        <FormError>{state.error}</FormError>
        <Field label="Student's name" name="name" required autoComplete="off" defaultValue={v?.name} key={`n${v?.name}`} error={f?.name} />
        <Field label="Class" name="className" required autoComplete="off" placeholder="Class 10" defaultValue={v?.className} key={`c${v?.className}`} error={f?.className} />
        <Field
          label="Username"
          name="username"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={v?.username}
          key={`u${v?.username}`}
          error={f?.username}
        />
        <Field
          label="Password"
          name="password"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          minLength={rules.accounts.passwordMinLength}
          defaultValue={v?.password}
          key={`p${v?.password}`}
          hint="Shown so you can pass it on. You can change it later."
          error={f?.password}
        />
        <SubmitButton>Create student account</SubmitButton>
        <p className="text-center text-sm">
          <Link href="/students" className="link">
            Back to your students
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function StudentAdded({ student, parentEmail, onAddAnother }: { student: CreatedStudent; parentEmail: string; onAddAnother: () => void }) {
  const rows: [string, string, boolean][] = [
    ["Name", student.name, false],
    ["Class", student.className, false],
    ["Username", student.username, true],
    ["Password", student.password, true],
  ];
  return (
    <AuthLayout variant="steps" currentStep={3} headline={`${student.name} is all set.`}>
      <span aria-hidden="true" className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <AuthHeading title="Student added">
        {student.name}&apos;s account is ready. Share these sign-in details with {student.name}.
      </AuthHeading>
      <dl className="divide-y divide-line rounded border border-line bg-card px-[18px]">
        {rows.map(([label, value, mono]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className={`font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm text-ink-muted">
        Each time {student.name} signs in, a 6-digit code is sent to your email, {parentEmail}.
      </p>
      <div className="mt-5 flex flex-col gap-2.5">
        <Link href={`/students/${student.id}/setup`} className="btn-primary h-[54px] w-full">
          Set up {student.name}&apos;s practice
        </Link>
        <button type="button" onClick={onAddAnother} className="btn-outline h-[54px] w-full">
          Add another student
        </button>
        <Link href="/students" className="link mt-3 self-center text-[15px] font-semibold">
          Go to your students
        </Link>
      </div>
    </AuthLayout>
  );
}
