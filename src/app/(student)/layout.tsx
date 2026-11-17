import { AppShell } from "@/components/AppShell";
import { ExamsIcon, TracksIcon } from "@/components/icons";
import { levelFor } from "@/domain/levels";
import { allowanceOf } from "@/server/ai/usage";
import { ConsentBanner } from "@/components/ConsentBanner";
import { AllowanceBanner } from "@/components/AllowanceBanner";
import { getLearnerConsent, requireShell } from "@/server/auth/current";
import { loadLearner } from "@/server/learners";
import { pointsTotal } from "@/server/results";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user: { student } } = await requireShell("learner");
  const total = await pointsTotal(student.id);
  // sm-1e: an under-18 learner sees where their parent's consent stands on every page (M10).
  const consent = await getLearnerConsent();
  // Only a self-managed learner holds their own AI allowance; a parent-managed learner's is their parent's. The
  // sidebar tracker is the holder's alone; the used-up banner tells a child too, so they know why exams stop.
  const selfManaged = student.type === "self_managed";
  const holder = (await loadLearner(student.id))?.holder;
  const holderAllowance = holder ? await allowanceOf(holder) : undefined;
  const allowance = selfManaged ? holderAllowance : undefined;
  return (
    <AppShell
      // A self-managed learner is a "Learner"; a child a parent manages is a "Student" (sm-5a, editions §2.7).
      user={{ name: student.name, role: "student", roleLabel: student.type === "self_managed" ? "Learner" : "Student" }}
      // A self-managed learner manages their tracks too, so the sidebar has Exams and Tracks (sm-3c).
      nav={
        student.type === "self_managed"
          ? [
              { href: "/today", label: "Exams", icon: <ExamsIcon />, match: ["/profile", "/exam", "/points"] },
              { href: "/tracks", label: "Tracks", icon: <TracksIcon />, match: ["/tracks"] },
            ]
          : [{ href: "/today", label: "Exams", icon: <ExamsIcon />, match: ["/profile", "/tracks", "/exam"] }]
      }
      points={{ total, levelName: levelFor(total).current, href: "/points" }}
      allowance={allowance}
    >
      {consent && <ConsentBanner consent={consent} timeZone={student.timeZone} />}
      <AllowanceBanner allowance={holderAllowance} viewer={selfManaged ? "holder" : "child"} />
      {children}
    </AppShell>
  );
}
