import { NavLink, Outlet } from "react-router";
import { signOut, useSession } from "../lib/auth";

const NAV = [
  { to: "/den", label: "收藏" },
  { to: "/shaves", label: "刮鬍日誌" },
  { to: "/stats", label: "統計" },
];

export function Layout() {
  const { user } = useSession();

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-(--color-line) bg-(--color-paper)/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-10 px-4 sm:px-6">
          <NavLink
            to="/den"
            className="font-serif text-lg font-semibold tracking-[0.15em] text-(--color-brass) uppercase"
          >
            Shaving Den
          </NavLink>

          <nav className="flex items-center gap-8">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `border-b-2 py-1 text-sm font-medium transition ${
                    isActive
                      ? "border-(--color-brass) text-(--color-ink)"
                      : "border-transparent text-(--color-ink-soft) hover:text-(--color-ink)"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user?.image && (
              <img
                src={user.image}
                alt=""
                referrerPolicy="no-referrer"
                className="size-8 rounded-full border-[1.5px] border-(--color-brass)"
              />
            )}
            <button
              type="button"
              onClick={() => signOut()}
              title="登出"
              className="flex size-8 items-center justify-center rounded-full border border-(--color-line) text-(--color-ink-faint) transition hover:border-(--color-brass) hover:text-(--color-brass)"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Outlet />
      </div>
    </div>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M15 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9" />
      <path d="M10 12h10m0 0-3-3m3 3-3 3" />
    </svg>
  );
}
