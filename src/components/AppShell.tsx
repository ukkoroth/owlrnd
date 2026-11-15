import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { NavLinks, type NavItem } from "./NavLinks";
import { ProfileMenu } from "./ProfileMenu";
import { PointsBox } from "./PointsBox";

export type { NavItem };

type Props = {
  user: { name: string; role: "parent" | "student" };
  nav: NavItem[];
  /** Students only: the points box above the profile button. Links to the points page once it exists (M6). */
  points?: { total: number; levelName: string | null; href?: string };
  children: ReactNode;
};

/**
 * Blue sidebar + content area used by every signed-in screen.
 * On narrow screens the sidebar stacks above the content (docs/08-design.md, Layout).
 */
export function AppShell({ user, nav, points, children }: Props) {
  const isStudent = user.role === "student";
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col gap-7 bg-sidebar px-5 py-7 text-white md:sticky md:top-0 md:h-screen md:w-[220px] md:shrink-0">
        <div className="px-2">
          <Logo />
        </div>
        <NavLinks items={nav} />
        <div className="flex flex-col gap-7 md:mt-auto">
          {isStudent && points && (
            <PointsBox points={points} />
          )}
          <ProfileMenu
            name={user.name}
            roleLabel={isStudent ? "Student" : "Parent"}
            profileHref={isStudent ? "/profile" : "/parent/profile"}
            signOutAction="/api/auth/sign-out"
          />
        </div>
      </aside>
      <main className="flex-1 px-4 py-8 md:px-16 md:py-12">
        <div className="mx-auto max-w-app">{children}</div>
      </main>
    </div>
  );
}
