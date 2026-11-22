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
      // Exams and Tracks for every learner: a self-managed learner manages their tracks there (sm-3c); a child sees
      // theirs read-only, with topic strength and goal progress, and no parent controls (4.1a; owner, 2026-11-22).
      nav={[
        { href: "/today", label: "Exams", icon: <ExamsIcon />, match: ["/profile", "/exam", "/points"] },
        { href: "/tracks", label: "Tracks", icon: <TracksIcon />, match: ["/tracks"] },
      ]}
      points={{ total, levelName: levelFor(total).current, href: "/points" }}
      allowance={allowance}
    >
      {consent && <ConsentBanner consent={consent} timeZone={student.timeZone} />}
      <AllowanceBanner allowance={holderAllowance} viewer={selfManaged ? "holder" : "child"} />
      {children}
    </AppShell>
  );
}
