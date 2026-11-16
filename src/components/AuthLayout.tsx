import Link from "next/link";
import { rules } from "@/config/rules";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

/** The set-up steps shown beside each sign-up path. */
export const PARENT_STEPS = ["Create your parent account", "Set up your child's username and password", "Add textbook pages or a syllabus"];
export const LEARNER_STEPS = ["Create your account", "Choose your exam or a package", "Take your first test"];

type Props =
  | { variant: "tagline"; children: ReactNode }
  /** sm-1a "Who is this account for?": the Rank-ready headline. */
  | { variant: "rank"; children: ReactNode }
  /** A headline and one paragraph (sm-1f, the parent's consent page). */
  | { variant: "message"; headline: ReactNode; lead: ReactNode; children: ReactNode }
  /** Set-up screens 1a, 1b (step 1), 2a (step 2), 2b (step 3): headline plus three set-up steps (the parent's by default). */
  | { variant: "steps"; headline: ReactNode; steps?: string[]; currentStep?: 1 | 2 | 3; children: ReactNode };

/** Signed-out screens: blue panel on the left, form on the right; stacked on narrow screens. */
export function AuthLayout(props: Props) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col gap-10 bg-sidebar px-6 py-8 text-white md:w-1/2 md:px-[102px] md:py-[58px]">
        <Link
          href="/"
          aria-label="owlrnd home"
          className="flex min-h-touch items-center self-start text-white no-underline focus-visible:outline-white"
        >
          <Logo height={36} />
        </Link>
        <div className="hidden flex-1 flex-col justify-center md:flex">
          {props.variant === "message" ? (
            <>
              <p className="text-[46px] font-semibold leading-[1.12] tracking-tight">{props.headline}</p>
              <p className="mt-6 max-w-[440px] text-[17px] leading-relaxed text-sidebar-muted">{props.lead}</p>
            </>
          ) : props.variant === "rank" ? (
            <>
              <p className="text-[56px] font-semibold leading-[1.08] tracking-tight">
                Rank-ready,
                <br />
                every day.
              </p>
              <p className="mt-6 max-w-[420px] text-[17px] leading-relaxed text-sidebar-muted">
                Short, exam-style tests written for you, marked straight away, and built from what you got wrong last time.
              </p>
            </>
          ) : props.variant === "tagline" ? (
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
                {(props.steps ?? PARENT_STEPS).map((step, i) => {
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
              {rules.access.inviteOnly ? "Get access" : "Create an account"}
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
