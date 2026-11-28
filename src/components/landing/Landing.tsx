import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { rules } from "@/config/rules";
import { site } from "@/config/site";
import { CapIcon, GitHubIcon, SparkleIcon, StarIcon, Swash } from "./icons";
import chatImg from "./img/chat.png";
import dashImg from "./img/dash.png";
import flashcardsImg from "./img/flashcards.png";
import paperImg from "./img/paper.png";
import parentImg from "./img/parent.png";
import picturesImg from "./img/pictures.png";
import { SiteFooter, SiteHeader } from "./SiteChrome";

/**
 * Public landing page: the Rank-ready page for self-managed learners, with one For parents section (#parents).
 * Copy, structure and design follow the landing hand-off of 2026-11-16 (docs/01-sections.md word for word), with
 * two owner changes: the exam has no numerical answers in 0.2, and the open-source section stays.
 * Screenshots live in ./img/; replace a file there (same name) to update it.
 */

// Imported, so each file gets a content-hashed URL (a swapped screenshot shows up at once) and its own size.
const SHOTS = {
  dash: { src: dashImg, alt: "A learner's owlrnd dashboard with three suggested JEE practice tests, each with a Practise flashcards button" },
  flashcards: { src: flashcardsImg, alt: "An owlrnd flashcard showing a question on Ohm's law, its answer and a one-line explanation, with Not yet and Got it buttons" },
  chat: { src: chatImg, alt: "A learner creating a JEE Physics track by chatting with the owlrnd AI" },
  paper: { src: paperImg, alt: "An owlrnd exam paper with numbered multiple-choice questions" },
  parent: { src: parentImg, alt: "The parent's view of two children's practice activity" },
  pictures: { src: picturesImg, alt: "An owlrnd marked paper where two wrong answers on mirrors each show a diagram with numbered steps: the angle measured from the normal, and sunlight meeting at the focus" },
};

const STEPS = [
  ["Choose your exam", "Start from a ready-made package for your exam, or chat with the AI and attach the syllabus, your coaching notes or a past paper."],
  ["Set a track and a goal", "The AI lists the topics and suggests a goal, such as 9 out of 10 in three tests in a row. Change anything before you start."],
  ["Practise every day", "Short papers of up to 10 questions, and flashcards in between. Each new test gives more weight to what you got wrong and brings back what you know, so it sticks."],
];

const EXAM_POINTS = [
  ["A reason for every miss", "Every marked test shows the right answer and a short worked explanation, with a picture where one helps."],
  ["Strengths and weak spots", "Every result lists the topics you have mastered and the ones costing you marks."],
  ["The next test adapts", "Weak topics come back until they are strong, and strong ones return now and then so they stay strong."],
];

/** 0.3.15 Pictures for wrong answers (docs/plan-wrong-answer-visuals.md). */
const PICTURE_POINTS = [
  ["Only where it helps", "Rays, angles, motion, shapes and amounts get a picture. Names and definitions don't: a picture won't help you remember a word."],
  ["Built from the question", "Every picture uses the question's own numbers and labels, and stays within your syllabus."],
  ["On your flashcards too", "Cards show the same pictures on the answer side, so the idea sticks between tests."],
];

/** No package is live in 0.2 (owner, 2026-11-15): every card shows "Coming soon" (hand-off, open items). */
/** 0.3 Flashcards (docs/plan-0.3-flashcards.md). */
const FLASHCARD_POINTS = [
  ["Written from your material", "Short cards on your syllabus and notes: definitions, formulas, units and quick one-step problems."],
  ["Your mistakes come back", "Questions you got wrong in a test return as flashcards, asked a new way, until they stick."],
  ["Spaced, so you remember", "Cards you know come back less often; the ones you are still learning come back the next day."],
];

const PACKAGES = [
  ["JEE Main", "Physics, Chemistry, Mathematics"],
  ["NEET UG", "Physics, Chemistry, Biology"],
  ["CUET UG", "Domain subjects and the general test"],
  ["CAT", "Quantitative ability, verbal ability, data interpretation and logical reasoning"],
  ["GATE", "Engineering subjects, engineering maths and general aptitude"],
  ["UPSC Prelims", "General studies and CSAT"],
  ["SSC CGL", "Quantitative aptitude, reasoning, English and general awareness"],
  ["Bank PO", "Quantitative aptitude, reasoning, English and banking awareness"],
];

const PACKAGE_POINTS = [
  ["You are in charge", "Set up, pause and change your tracks yourself. No parent or teacher account is needed."],
  ["Built from your material", "Questions stay within your syllabus and the notes you attach, at the level of your exam."],
  ["Secure sign-in", "Every sign-in sends a 6-digit code to your email, so your account stays yours."],
];

const PARENT_POINTS = [
  ["You set up the tracks", "Photograph the textbook pages or describe the chapter. The AI builds the tracks and goals with you."],
  ["Every sign-in comes to you", "Each time your child signs in, a 6-digit code is sent to your email."],
  ["See effort and weak spots", "One page for all your children: last exam, what needs work, and how often they practise, with tests and flashcards."],
];

/** Star badge shades, lightest to darkest, one per level. */
const LEVEL_SHADES = ["#7FA9F5", "#3F7CEB", "#2563EB", "#1E40AF", "#132C6B"];

const GOAL_SCORES = [6, 8, 9, 9, 10];

/** While sign-up is invite-only, the calls to action ask for access instead (rules.access.inviteOnly). */
const CTA = rules.access.inviteOnly ? { href: "/get-access", label: "Get access" } : { href: "/sign-up", label: "Create your account" };

const btnOnBlue = "flex items-center justify-center rounded text-[17px] font-semibold no-underline focus-visible:outline-white";
const btnWhite = `${btnOnBlue} bg-white text-sidebar hover:bg-[#EAF1FF]`;

export function Landing() {
  return (
    <div id="landing" className="bg-page text-ink">
      <SiteHeader home />
      <main>
        <Hero />
        <HowItWorks />
        <TheExam />
        <Pictures />
        <Flashcards />
        <Goals />
        <Packages />
        <Motivation />
        <ForParents />
        {site.sourceUrl && <OpenSource repoUrl={site.sourceUrl} />}
        <ComingSoon />
        <FinalCta />
      </main>
      <SiteFooter home />
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="landing-hero px-6 pt-[4.5rem] text-white">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-7 text-center">
        <span className="inline-flex min-h-[34px] items-center gap-2 text-balance rounded border border-[#7AA2FF] bg-[#2A4DBF] px-3.5 py-1 text-sm font-semibold tracking-[0.01em]">
          <SparkleIcon className="shrink-0 text-amber" />
          AI-Powered Continuous Testing &amp; Evaluation for Competitive Exams
        </span>
        <h1 className="m-0 max-w-[14ch] text-balance text-[clamp(2.5rem,6.5vw,4.75rem)] font-bold leading-[1.02] tracking-[-0.03em]">
          Rank-ready,{" "}
          <span className="relative inline-block text-amber">
            every day.
            <Swash />
          </span>
        </h1>
        <p className="m-0 max-w-[40rem] text-pretty text-[clamp(1.0625rem,2vw,1.25rem)] leading-[1.55] text-[#EAF1FF]">
          Pick your exam, attach the syllabus or your notes, and owlrnd writes exam-style tests for you, marks them, and
          builds every new test from what you got wrong on the last one.
        </p>
        <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link href={CTA.href} className={`${btnWhite} h-[54px] px-7`}>
            {CTA.label}
          </Link>
          <Link href="#how" className={`${btnOnBlue} h-[54px] border-[1.5px] border-[#7AA2FF] px-6 text-white hover:bg-[#2A4DBF]`}>
            See how it works
          </Link>
        </div>
        <div className="flex flex-col items-center gap-2.5">
          <p className="m-0 flex items-center gap-2.5 text-base font-semibold">
            <CapIcon className="shrink-0 text-amber" />
            Developed by experts in education
          </p>
          <p className="m-0 text-sm text-sidebar-muted">For aspirants preparing on their own. Set up in minutes, works in the browser.</p>
        </div>
        <div className="mb-[-10rem] mt-4 w-full max-w-[1040px] overflow-hidden rounded border border-line bg-white">
          <div aria-hidden="true" className="flex gap-1.5 border-b border-line bg-page px-3 py-2.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-full bg-line" />
            ))}
          </div>
          <Image {...SHOTS.dash} alt={SHOTS.dash.alt} priority sizes="(min-width: 1088px) 1040px, 100vw" className="block h-auto w-full" />
        </div>
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-sm font-bold uppercase tracking-[0.06em] text-brand">{children}</span>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-balance text-[clamp(2rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.02em]">{children}</h2>;
}

function Shot({ shot, border = "border-line", sizes = "(min-width: 1228px) 1180px, 100vw" }: { shot: (typeof SHOTS)[keyof typeof SHOTS]; border?: string; sizes?: string }) {
  return (
    <div className={`overflow-hidden rounded border bg-white ${border}`}>
      <Image {...shot} alt={shot.alt} sizes={sizes} className="block h-auto w-full" />
    </div>
  );
}

function Points({ items }: { items: string[][] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-x-10 gap-y-6 p-0 md:grid-cols-3">
      {items.map(([title, body]) => (
        <li key={title} className="flex flex-col gap-1.5">
          <h3 className="m-0 text-lg font-semibold">{title}</h3>
          <p className="m-0 text-[15px] leading-[1.55] text-ink-muted">{body}</p>
        </li>
      ))}
    </ul>
  );
}

/** Heading on the left, paragraph on the right; stacked on narrow screens. */
function SectionIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <H2>{title}</H2>
      </div>
      <p className="m-0 min-w-0 flex-[1_1_380px] text-[17px] leading-[1.55] text-ink-muted">{children}</p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-4 px-6 pb-20 pt-56">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <div className="flex max-w-[44rem] flex-col gap-2.5">
          <Eyebrow>How it works</Eyebrow>
          <H2>From syllabus to first test in a few minutes.</H2>
        </div>
        <div className="flex flex-wrap items-start gap-x-14 gap-y-10">
          <ol className="m-0 flex min-w-0 flex-[1_1_360px] list-none flex-col gap-7 p-0">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex items-start gap-[18px]">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sidebar text-lg font-bold text-white"
                >
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-[21px] font-semibold">{title}</h3>
                  <p className="m-0 text-base leading-[1.55] text-ink-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="min-w-0 flex-[1_1_440px] overflow-hidden rounded border border-line bg-white">
            <Image {...SHOTS.chat} alt={SHOTS.chat.alt} sizes="(min-width: 1024px) 600px, 100vw" className="block h-auto w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

function TheExam() {
  return (
    <section className="border-y border-line bg-white px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9">
        {/* Owner, 2026-11-16: no numerical-answer questions in 0.2, so the hand-off's "numerical answers" is left out. */}
        <SectionIntro eyebrow="The exam" title="It feels like the real paper.">
          A clean page, numbered questions in a printed-paper typeface, and one Submit button. Multiple choice and short
          written answers. Every page fits the screen, so there is no scrolling.
        </SectionIntro>
        <Shot shot={SHOTS.paper} border="border-paper-rule" />
        <Points items={EXAM_POINTS} />
      </div>
    </section>
  );
}

function Pictures() {
  return (
    <section id="pictures" className="scroll-mt-4 px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9">
        <SectionIntro eyebrow="Pictures" title="See why, not just what.">
          When you get a question wrong, the marked test can show a short animated diagram under the explanation. It
          plays one step at a time and shows the common slip next to the right idea.
        </SectionIntro>
        <Shot shot={SHOTS.pictures} border="border-paper-rule" />
        <Points items={PICTURE_POINTS} />
      </div>
    </section>
  );
}

function Flashcards() {
  return (
    <section id="flashcards" className="scroll-mt-4 border-y border-line bg-white px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9">
        <SectionIntro eyebrow="Flashcards" title="Learn it between tests.">
          A few minutes at a time: read the question, think, show the answer, and say Got it or Not yet. No marks and no
          effect on your goal, just practice that makes the next test easier.
        </SectionIntro>
        <Shot shot={SHOTS.flashcards} />
        <Points items={FLASHCARD_POINTS} />
      </div>
    </section>
  );
}

function Goals() {
  const max = Math.max(...GOAL_SCORES);
  return (
    <section className="px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-16 gap-y-10">
        <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
          <Eyebrow>Goals</Eyebrow>
          <H2>Practice with a finish line.</H2>
          <p className="m-0 text-[17px] leading-[1.55] text-ink-muted">
            Every track has a goal you set. When you reach it, the track stops, so you move on instead of over-practising
            what you already know. Add the next chapter whenever you are ready and set a new goal.
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4 rounded border-2 border-brand bg-white p-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-sidebar">Goal reached · well done</span>
            <h3 className="m-0 text-[22px] font-semibold">JEE Physics: Current electricity</h3>
          </div>
          <div
            role="img"
            aria-label={`Scores in the last five exams: ${GOAL_SCORES.join(", ")}`}
            className="flex h-[76px] items-end gap-2 border-b border-ink pb-px"
          >
            {GOAL_SCORES.map((score, i) => {
              const last = i === GOAL_SCORES.length - 1;
              return (
                <div key={i} className="flex w-7 flex-col items-center gap-[3px]">
                  <span className={`text-xs ${last ? "font-semibold" : "text-ink-muted"}`}>{score}</span>
                  <div className={`w-7 ${last ? "bg-brand" : "bg-[#A9C4FF]"}`} style={{ height: `${(score / max) * 60}px` }} />
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5 rounded bg-pale px-3.5 py-3">
            <div className="flex justify-between gap-x-3 text-sm">
              <span>
                <span className="font-bold">Goal: </span>9 / 10 or better in 3 exams in a row
              </span>
              <span className="font-semibold text-sidebar">Reached</span>
            </div>
            <div aria-hidden="true" className="grid grid-cols-3 gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-2 bg-brand" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Packages() {
  return (
    <section id="packages" className="scroll-mt-4 border-y border-line bg-white px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9">
        <SectionIntro eyebrow="Packages" title="Start from your exam, or build your own.">
          Pick a package and owlrnd sets up tracks that follow that exam&apos;s syllabus and question style. Add your own
          topics, notes and goals on top, or skip packages and build every track yourself.
        </SectionIntro>
        <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {PACKAGES.map(([name, line]) => (
            <li key={name} className="flex flex-col gap-1.5 rounded border border-line bg-page px-5 py-[18px]">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-brand">Package</span>
                <span className="inline-flex h-[22px] items-center rounded bg-pale px-2 text-[11px] font-bold uppercase tracking-[0.04em] text-sidebar">
                  Coming soon
                </span>
              </span>
              <h3 className="m-0 text-lg font-semibold">{name}</h3>
              <p className="m-0 text-[15px] leading-[1.5] text-ink-muted">{line}</p>
            </li>
          ))}
          <li className="flex flex-col gap-1.5 rounded border-[1.5px] border-dashed border-brand bg-pale-2 px-5 py-[18px]">
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-brand">Your own</span>
            <h3 className="m-0 text-lg font-semibold">Build your own track</h3>
            <p className="m-0 text-[15px] leading-[1.5] text-ink-muted">
              Any exam, any topic: attach your syllabus, notes or past papers and the AI sets it up.
            </p>
          </li>
        </ul>
        <Points items={PACKAGE_POINTS} />
      </div>
    </section>
  );
}

function Motivation() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        <SectionIntro eyebrow="Motivation" title="Points for showing up and getting better.">
          You earn points for finishing tests, beating your last score, turning a weak topic strong and practising day
          after day, not just for top marks. Points only go up.
        </SectionIntro>
        {/* Names and thresholds come from the app's points rules, so the two never drift apart. */}
        <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-3 lg:grid-cols-5">
          {rules.points.levels.map((level, i) => (
            <li key={level.name} className="flex flex-col items-center gap-2 rounded border border-line bg-white px-3 py-[22px] text-center">
              <span
                aria-hidden="true"
                className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-white"
                style={{ background: LEVEL_SHADES[i] ?? LEVEL_SHADES[LEVEL_SHADES.length - 1] }}
              >
                <StarIcon />
              </span>
              <span className="text-[17px] font-semibold">{level.name}</span>
              <span className="text-sm text-ink-muted">{level.at.toLocaleString("en-GB")} points</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ForParents() {
  return (
    <section id="parents" className="scroll-mt-4 border-y border-line bg-white px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-14 gap-y-10">
        <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
          <Eyebrow>For parents</Eyebrow>
          <H2>Setting this up for your child?</H2>
          <p className="m-0 text-[17px] leading-[1.55] text-ink-muted">
            owlrnd also works for school students, with a parent in charge. You set up the practice from their textbooks;
            they just practise.
          </p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-4 p-0">
            {PARENT_POINTS.map(([title, body]) => (
              <li key={title} className="flex items-start gap-3">
                <TickIcon />
                <div className="flex flex-col gap-1">
                  <h3 className="m-0 text-lg font-semibold">{title}</h3>
                  <p className="m-0 text-[15px] leading-[1.55] text-ink-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/sign-up?for=child" className="btn-primary mt-2 h-[52px] self-start px-6 text-base no-underline">
            Set up for my child
          </Link>
        </div>
        <div className="min-w-0 flex-[1_1_480px]">
          <Shot shot={SHOTS.parent} sizes="(min-width: 1024px) 640px, 100vw" />
        </div>
      </div>
    </section>
  );
}

function TickIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-brand">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

const OPEN_POINTS = [
  ["Nothing hidden", "The instructions that write and mark every exam are in the code. Anyone can read exactly how a child's paper is made."],
  ["Run your own", "A school, a tutor or a group of parents can host owlrnd for their own children. The README lists what it costs to run."],
  ["Improvements stay open", "Under the AGPL licence, anyone who changes owlrnd and offers it to others must share their changes too."],
];

/** Shown only once the repository is public (site.sourceUrl). The commands match the README's "Run it locally". */
function OpenSource({ repoUrl }: { repoUrl: string }) {
  const lines: [string, string?][] = [
    [`git clone ${repoUrl}.git`],
    ["cd owlrnd && npm install"],
    ["cp .env.example .env.local", "set AUTH_SECRET"],
    ["npm run db:up && npm run db:migrate"],
    ["npm run dev", "http://localhost:3000"],
  ];
  return (
    <section aria-labelledby="open" className="border-y border-line bg-white px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-16 gap-y-10">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-4">
          <Eyebrow>Open source</Eyebrow>
          <h2 id="open" className="m-0 text-balance text-[clamp(2rem,4vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.02em]">
            Built in the open.
          </h2>
          <p className="m-0 text-[17px] leading-[1.55] text-ink-muted">
            Every line of owlrnd is free and open source. Parents, teachers and schools can see how it works, run it
            themselves, and make it better for every child.
          </p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-4 p-0">
            {OPEN_POINTS.map(([title, body]) => (
              <li key={title} className="flex flex-col gap-1">
                <h3 className="m-0 text-lg font-semibold">{title}</h3>
                <p className="m-0 text-[15px] leading-[1.55] text-ink-muted">{body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
            <a href={repoUrl} className="btn-primary h-[52px] px-6 text-base no-underline">
              <GitHubIcon size={20} />
              View the code on GitHub
            </a>
            <span className="text-sm text-ink-muted">Licensed AGPL-3.0</span>
          </div>
        </div>

        <figure className="m-0 min-w-0 flex-[1_1_440px] overflow-hidden rounded bg-ink text-[#D3E0FF]">
          <div aria-hidden="true" className="flex items-center gap-1.5 border-b border-[#2A4DBF] px-4 py-3">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#2A4DBF]" />
            ))}
            <span className="ml-3 text-xs text-[#A9C4FF]">Run owlrnd yourself</span>
          </div>
          <pre tabIndex={0} aria-label="Commands to run owlrnd yourself" className="m-0 overflow-x-auto p-5 font-mono text-[13px] leading-[1.9] focus-visible:outline-white sm:text-sm">
            <code>
              {lines.map(([cmd, note]) => (
                <span key={cmd} className="block whitespace-pre">
                  <span className="select-none text-[#7AA2FF]">$ </span>
                  <span className="text-white">{cmd}</span>
                  {note && <span className="text-[#A9C4FF]">{`   # ${note}`}</span>}
                </span>
              ))}
            </code>
          </pre>
          <figcaption className="border-t border-[#2A4DBF] px-5 py-3 text-xs text-[#A9C4FF]">
            Needs Node 20 and Docker. Full steps in the README.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function ComingSoon() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-2.5 rounded border-[1.5px] border-dashed border-line-input bg-white px-[26px] py-[22px]">
        <span className="inline-flex h-[26px] items-center rounded bg-pale px-2.5 text-xs font-bold uppercase tracking-[0.04em] text-sidebar">
          Coming soon
        </span>
        <span className="text-base leading-normal">Full-length timed mock tests, and handwritten answers you can photograph and upload.</span>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-sidebar px-6 py-20 text-white">
      <div className="mx-auto flex max-w-[760px] flex-col items-center gap-[22px] text-center">
        <h2 className="m-0 text-balance text-[clamp(2rem,4.5vw,3rem)] font-bold leading-[1.1] tracking-[-0.02em]">Set up your first track tonight.</h2>
        <p className="m-0 text-lg leading-[1.55] text-[#EAF1FF]">
          Create your account, choose your exam or attach your syllabus, and your first test is ready straight away.
        </p>
        <Link href={CTA.href} className={`${btnWhite} h-14 px-[30px]`}>
          {CTA.label}
        </Link>
      </div>
    </section>
  );
}
