import Link from "next/link";
import { rules } from "@/config/rules";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

const STEPS = ["Create your parent account", "Set up your child's username and password", "Add textbook pages or a syllabus"];

type Props =
  | { variant: "tagline"; children: ReactNode }
  /** Set-up screens 1a, 1b (step 1), 2a (step 2), 2b (step 3): headline plus the three set-up steps. */
  | { variant: "steps"; headline: ReactNode; currentStep?: 1 | 2 | 3; children: ReactNode };

/** Signed-out screens: blue panel on the left, form on the right; stacked on narrow screens. */
export function AuthLayout(props: Props) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col gap-10 bg-sidebar px-6 py-8 text-white md:w-1/2 md:px-[102px] md:py-[58px]">
        <Logo height={36} />
        <div className="hidden flex-1 flex-col justify-center md:flex">
          {props.variant === "tagline" ? (
            <>
              <p className="text-[56px] font-semibold leading-[1.08] tracking-tight">
                Practice that moves at
                <br />
                your level.
              </p>
              <p className="mt-6 max-w-[420px] text-[17px] leading-relaxed text-sidebar-muted">
                Every exam shows what you are strong at and what needs work. The next one is built around it.
              </p>
            </>
          ) : (
            <>
              <p className="text-[46px] font-semibold leading-[1.12] tracking-tight">{props.headline}</p>
              <ol className="mt-8 flex flex-col gap-3.5">
                {STEPS.map((step, i) => {
                  const n = i + 1;
                  const current = n === (props.currentStep ?? 1);
                  const done = n < (props.currentStep ?? 1);
                  return (
                    <li
                      key={step}
                      aria-current={current ? "step" : undefined}
                      className={`flex items-center gap-3.5 text-[17px] ${current ? "font-semibold" : done ? "" : "text-sidebar-muted"}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                          current ? "bg-white text-sidebar" : done ? "border-2 border-white" : "border border-sidebar-muted"
                        }`}
                      >
                        {n}
                      </span>
                      {step}
                      {done && <span className="sr-only"> (done)</span>}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
        {props.variant === "tagline" && (
          <p className="hidden text-sm text-sidebar-muted md:block">
            New to owlrnd?{" "}
            <Link href={rules.access.inviteOnly ? "/get-access" : "/sign-up"} className="font-semibold text-white underline underline-offset-2">
              {rules.access.inviteOnly ? "Get access" : "Create a parent account"}
            </Link>
          </p>
        )}
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-10 md:px-10">
        <div className="w-full max-w-[400px]">{props.children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-[28px] leading-tight">{title}</h1>
      {children && <p className="mt-1.5 text-[15px] text-ink-muted">{children}</p>}
    </div>
  );
}
