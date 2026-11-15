import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { rules } from "@/config/rules";
import { site } from "@/config/site";
import { CapIcon, GitHubIcon, PeopleIcon, SparkleIcon, StarIcon, Swash } from "./icons";
import chatImg from "./img/chat.png";
import dashImg from "./img/dash.png";
import paperImg from "./img/paper.png";
import parentImg from "./img/parent.png";
import { SiteFooter, SiteHeader } from "./SiteChrome";

/**
 * Public landing page. Copy, structure and design follow the landing hand-off (docs/01-sections.md word for word).
 * Screenshots live in ./img/; replace a file there (same name) to update it.
 */

// Imported, so each file gets a content-hashed URL (a swapped screenshot shows up at once) and its own size.
const SHOTS = {
  dash: { src: dashImg, alt: "A student's owlrnd dashboard showing today's suggested practice exams" },
  chat: { src: chatImg, alt: "A parent creating a practice track by chatting with the owlrnd AI" },
  paper: { src: paperImg, alt: "An owlrnd exam paper with numbered multiple-choice questions" },
  parent: { src: parentImg, alt: "The parent's view of two children's practice activity" },
};

const STATS = [
  {
    group: "Parents",
    icon: <PeopleIcon />,
    cells: [
      ["A few minutes", "to set up each chapter"],
      ["About 10 minutes a week", "to check progress"],
    ],
  },
  {
    group: "Children",
    icon: <CapIcon size={18} tassel={false} />,
    cells: [
      ["2–3 short exams a day", "about 10 minutes each"],
      ["A new exam every time", "written, marked and adapted automatically"],
    ],
  },
];

const STEPS = [
  ["Tell owlrnd what they are studying", "Chat with the AI. Attach photos of the textbook pages, the syllabus, or just describe the chapter and the test date."],
  ["Agree a track and a goal", "The AI finds the topics and suggests a goal, such as 9 out of 10 in three exams in a row. You change anything before it goes live."],
  ["Your child practises", "Short papers of up to 10 questions. Each new exam gives more weight to what they found hard and brings back what they know, so it sticks."],
];

const EXAM_POINTS = [
  ["A reason for every miss", "The marked paper shows the right answer and a one-line explanation, written for a child."],
  ["Strengths and weak spots", "Every result lists the topics they have mastered and the ones that need more practice."],
  ["The next exam adapts", "Weak topics come back until they are strong, and strong ones return now and then so they stay strong."],
];

const PARENT_POINTS = [
  ["You stay in control", "You add each child, set up their tracks and goals, and pause a track whenever you like. Your child just practises."],
  ["Every sign-in comes to you", "Each time anyone signs in, a 6-digit code is sent to your email, so you always know when practice starts."],
  ["Built from your material", "Questions stay within the pages and topics you provide, at your child's class level. No surprises."],
];

/** Star badge shades, lightest to darkest, one per level. */
const LEVEL_SHADES = ["#7FA9F5", "#3F7CEB", "#2563EB", "#1E40AF", "#132C6B"];

const GOAL_SCORES = [6, 8, 9, 9, 10];

/** Closed beta: the calls to action ask for access instead of opening sign-up (rules.access.inviteOnly). */
const CTA = rules.access.inviteOnly ? { href: "/get-access", label: "Get access" } : { href: "/sign-up", label: "Create a parent account" };

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
        <Goals />
        <ForParents />
        <Motivation />
        <ComingSoon />
        {site.sourceUrl && <OpenSource repoUrl={site.sourceUrl} />}
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="landing-hero px-6 pt-[4.5rem] text-white">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-7 text-center">
        <span className="inline-flex min-h-[34px] items-center gap-2 text-balance rounded border border-[#7AA2FF] bg-[#2A4DBF] px-3.5 py-1 text-sm font-semibold tracking-[0.01em]">
          <SparkleIcon className="shrink-0 text-amber" />
          AI-Powered Automatic Continuous Testing &amp; Evaluation for Students
        </span>
        <h1 className="m-0 max-w-[14ch] text-balance text-[clamp(2.5rem,6.5vw,4.75rem)] font-bold leading-[1.02] tracking-[-0.03em]">
          Exam-ready,{" "}
          <span className="relative inline-block text-amber">
            every day.
            <Swash />
          </span>
        </h1>
        <p className="m-0 max-w-[40rem] text-pretty text-[clamp(1.0625rem,2vw,1.25rem)] leading-[1.55] text-[#EAF1FF]">
          Photograph the textbook pages or describe the chapter. owlrnd writes short, paper-style exams for your child, and
          every new exam is built from how they did on the last one.
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
            Built with teachers and parents
          </p>
          <p className="m-0 text-sm text-sidebar-muted">For school students, set up by their parents. Works in the browser.</p>
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

function Shot({ shot, border = "border-line" }: { shot: (typeof SHOTS)[keyof typeof SHOTS]; border?: string }) {
  return (
    <div className={`overflow-hidden rounded border bg-white ${border}`}>
      <Image {...shot} alt={shot.alt} sizes="(min-width: 1228px) 1180px, 100vw" className="block h-auto w-full" />
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

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-4 px-6 pb-20 pt-56">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10">
        <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-2">
          {STATS.map((s) => (
            <div key={s.group} className="flex flex-col border-t-[3px] border-brand bg-line">
              <h3 className="m-0 flex items-center justify-center gap-2 border-b border-line bg-white px-4 py-3 text-[13px] font-bold uppercase tracking-[0.06em] text-sidebar">
                {s.icon}
                {s.group}
              </h3>
              <ul className="m-0 grid flex-1 list-none grid-cols-1 gap-px border-b border-line p-0 sm:grid-cols-2">
                {s.cells.map(([figure, line]) => (
                  <li key={figure} className="flex flex-col justify-center gap-2 bg-white px-5 py-[26px] text-center">
                    <span className="text-[clamp(1.625rem,2.6vw,2.125rem)] font-bold leading-[1.1] tracking-[-0.02em]">{figure}</span>
                    <span className="text-balance text-base leading-[1.45] text-brand">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex max-w-[44rem] flex-col gap-2.5">
          <Eyebrow>How it works</Eyebrow>
          <H2>From a textbook photo to a first exam in a few minutes.</H2>
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
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
            <Eyebrow>The exam</Eyebrow>
            <H2>It feels like a real exam paper.</H2>
          </div>
          <p className="m-0 min-w-0 flex-[1_1_380px] text-[17px] leading-[1.55] text-ink-muted">
            A white page, numbered questions in a printed-paper typeface, and one Submit button. Multiple choice and short answers. Every page fits the screen, so there is no scrolling.
          </p>
        </div>
        <Shot shot={SHOTS.paper} border="border-paper-rule" />
        <Points items={EXAM_POINTS} />
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
            Every track has a goal you agree on. When your child reaches it, the track stops, so practice never drags on past
            the point of learning. Add the next chapter whenever you are ready and set a new goal.
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4 rounded border-2 border-brand bg-white p-6">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-sidebar">Goal reached · well done</span>
            <h3 className="m-0 text-[22px] font-semibold">Physics: Current electricity</h3>
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

function ForParents() {
  return (
    <section id="parents" className="scroll-mt-4 border-y border-line bg-white px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-9">
        <div className="flex max-w-[46rem] flex-col gap-2.5">
          <Eyebrow>For parents</Eyebrow>
          <H2>See effort and weak spots at a glance.</H2>
          <p className="m-0 text-[17px] leading-[1.55] text-ink-muted">
            One page for all your children: their last exam, what needs work, and a day-by-day picture of how often they
            practise.
          </p>
        </div>
        <Shot shot={SHOTS.parent} />
        <Points items={PARENT_POINTS} />
      </div>
    </section>
  );
}

function Motivation() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
            <Eyebrow>Motivation</Eyebrow>
            <H2>Points for showing up and getting better.</H2>
          </div>
          <p className="m-0 min-w-0 flex-[1_1_380px] text-[17px] leading-[1.55] text-ink-muted">
            Children earn points for finishing exams, improving on their last score, turning a weak topic strong and
            practising day after day, not just for top marks. Points only go up.
          </p>
        </div>
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
    <section className="px-6 pb-20">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-2.5 rounded border-[1.5px] border-dashed border-line-input bg-white px-[26px] py-[22px]">
        <span className="inline-flex h-[26px] items-center rounded bg-pale px-2.5 text-xs font-bold uppercase tracking-[0.04em] text-sidebar">
          Coming soon
        </span>
        <span className="text-base leading-normal">
          Ready-made packages for CBSE and ICSE, and handwritten answers your child can photograph and upload.
        </span>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-sidebar px-6 py-20 text-white">
      <div className="mx-auto flex max-w-[760px] flex-col items-center gap-[22px] text-center">
        <h2 className="m-0 text-balance text-[clamp(2rem,4.5vw,3rem)] font-bold leading-[1.1] tracking-[-0.02em]">
          {rules.access.inviteOnly ? "Be one of the first families on owlrnd." : "Set up your child's first track tonight."}
        </h2>
        <p className="m-0 text-lg leading-[1.55] text-[#EAF1FF]">
          {rules.access.inviteOnly
            ? "We're opening owlrnd to a small group of families first. Ask for access, and when your invitation arrives, setting up your child's first track takes a few minutes."
            : "Create your account, add your child, and photograph the chapter they are studying. Their first exam is ready within minutes."}
        </p>
        <Link href={CTA.href} className={`${btnWhite} h-14 px-[30px]`}>
          {CTA.label}
        </Link>
      </div>
    </section>
  );
}
